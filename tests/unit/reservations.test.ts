import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition } from '#/server/inventory/state-machine'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

describe('phase 8 reservation lifecycle', () => {
  it('walks a hold from active to fulfilled', () => {
    expect(() => assertTransition('reservation', 'active', 'fulfilled')).not.toThrow()
    expect(() => assertTransition('reservation', 'active', 'partially_fulfilled')).not.toThrow()
    expect(() =>
      assertTransition('reservation', 'partially_fulfilled', 'fulfilled')
    ).not.toThrow()
  })

  it('releases or expires an open hold', () => {
    expect(canTransition('reservation', 'active', 'released')).toBe(true)
    expect(canTransition('reservation', 'active', 'expired')).toBe(true)
    expect(canTransition('reservation', 'partially_fulfilled', 'released')).toBe(true)
  })

  it('treats fulfilled/released/expired as terminal', () => {
    expect(canTransition('reservation', 'fulfilled', 'active')).toBe(false)
    expect(canTransition('reservation', 'released', 'active')).toBe(false)
    expect(canTransition('reservation', 'expired', 'fulfilled')).toBe(false)
  })
})

describe('phase 8 sales-order reserve transition', () => {
  it('lets a confirmed order reserve then fulfil', () => {
    expect(canTransition('salesOrder', 'confirmed', 'reserved')).toBe(true)
    expect(canTransition('salesOrder', 'reserved', 'fulfilled')).toBe(true)
    expect(canTransition('salesOrder', 'reserved', 'cancelled')).toBe(true)
  })

  it('still allows direct confirmed→fulfilled (unreserved flow)', () => {
    expect(canTransition('salesOrder', 'confirmed', 'fulfilled')).toBe(true)
  })
})

describe('phase 8 RBAC', () => {
  it('registers and links inventory.reserve', () => {
    expect(isPermissionCode('inventory.reserve')).toBe(true)
    expect(PERMISSION_LINKS['inventory.reserve']).toBeDefined()
  })

  it('grants reserve to inventory/warehouse/sales managers', () => {
    expect(ROLE_PERMISSION_MAP.inventory_manager).toContain('inventory.reserve')
    expect(ROLE_PERMISSION_MAP.warehouse_manager).toContain('inventory.reserve')
    expect(ROLE_PERMISSION_MAP.sales_manager).toContain('inventory.reserve')
  })

  it('does not grant reserve to the POS cashier', () => {
    expect(ROLE_PERMISSION_MAP.pos_cashier).not.toContain('inventory.reserve')
  })
})
