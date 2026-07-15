import { describe, expect, it } from 'vitest'
import { ValidationError } from '#/server/auth/errors'
import {
  assertTrackingCompliance,
  requiresLot,
  requiresSerial,
  serialTransition,
} from '#/server/inventory/tracking-policy'
import { assertTransition, canTransition } from '#/server/inventory/state-machine'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

describe('phase 9 tracking-policy enforcement', () => {
  it('requires a lot for LOT / LOT_SERIAL products', () => {
    expect(requiresLot('LOT')).toBe(true)
    expect(requiresLot('LOT_SERIAL')).toBe(true)
    expect(requiresLot('SERIAL')).toBe(false)
    expect(() => assertTrackingCompliance('LOT', { quantity: 5, lotId: null })).toThrow(
      ValidationError
    )
    expect(() =>
      assertTrackingCompliance('LOT', { quantity: 5, lotId: 'lot-1' })
    ).not.toThrow()
  })

  it('requires a serial at qty 1 for SERIAL products', () => {
    expect(requiresSerial('SERIAL')).toBe(true)
    expect(() => assertTrackingCompliance('SERIAL', { quantity: 1, serialId: null })).toThrow(
      ValidationError
    )
    // serial present but qty != 1 is rejected
    expect(() =>
      assertTrackingCompliance('SERIAL', { quantity: 2, serialId: 'sn-1' })
    ).toThrow(ValidationError)
    expect(() =>
      assertTrackingCompliance('SERIAL', { quantity: 1, serialId: 'sn-1' })
    ).not.toThrow()
  })

  it('LOT_SERIAL needs both a lot and a serial at qty 1', () => {
    expect(() =>
      assertTrackingCompliance('LOT_SERIAL', { quantity: 1, lotId: 'l', serialId: 's' })
    ).not.toThrow()
    expect(() =>
      assertTrackingCompliance('LOT_SERIAL', { quantity: 1, lotId: 'l', serialId: null })
    ).toThrow(ValidationError)
  })

  it('NONE products need nothing', () => {
    expect(() => assertTrackingCompliance('NONE', { quantity: 9 })).not.toThrow()
  })
})

describe('phase 9 serial movement transitions', () => {
  it('a sale sells the serial and clears its location', () => {
    const t = serialTransition('SALE', 'OUT')
    expect(t.status).toBe('SOLD')
    expect(t.toTarget).toBe(false)
    expect(t.sold).toBe(true)
  })

  it('a receipt lands the serial in stock at the target', () => {
    expect(serialTransition('PURCHASE_RECEIPT', 'IN').status).toBe('IN_STOCK')
    expect(serialTransition('PURCHASE_RECEIPT', 'IN').toTarget).toBe(true)
  })

  it('a transfer-out puts the serial in transit', () => {
    expect(serialTransition('TRANSFER_OUT', 'OUT').status).toBe('IN_TRANSIT')
  })

  it('damage/loss scraps the serial', () => {
    expect(serialTransition('DAMAGE', 'OUT').status).toBe('SCRAPPED')
    expect(serialTransition('LOST', 'OUT').status).toBe('SCRAPPED')
  })
})

describe('phase 9 lot + serial lifecycle machines', () => {
  it('walks a lot to expiry and depletion', () => {
    expect(() => assertTransition('lot', 'active', 'quarantine')).not.toThrow()
    expect(() => assertTransition('lot', 'active', 'expired')).not.toThrow()
    expect(() => assertTransition('lot', 'expired', 'depleted')).not.toThrow()
    expect(canTransition('lot', 'depleted', 'active')).toBe(false)
  })

  it('walks a serial through sale and return', () => {
    expect(() => assertTransition('serial', 'in_stock', 'sold')).not.toThrow()
    expect(() => assertTransition('serial', 'sold', 'returned')).not.toThrow()
    expect(() => assertTransition('serial', 'returned', 'in_stock')).not.toThrow()
    expect(canTransition('serial', 'scrapped', 'in_stock')).toBe(false)
  })
})

describe('phase 9 RBAC', () => {
  it('registers and links lot/serial permissions', () => {
    for (const code of ['inventory.manage_lots', 'inventory.manage_serials'] as const) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
    }
  })

  it('grants lot/serial management to inventory + warehouse managers', () => {
    for (const role of ['inventory_manager', 'warehouse_manager'] as const) {
      expect(ROLE_PERMISSION_MAP[role]).toContain('inventory.manage_lots')
      expect(ROLE_PERMISSION_MAP[role]).toContain('inventory.manage_serials')
    }
  })
})
