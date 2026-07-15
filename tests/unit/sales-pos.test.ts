import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition } from '#/server/inventory/state-machine'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

const SALES_POS_PERMISSIONS = [
  'sales.order_view',
  'sales.order_create',
  'sales.order_confirm',
  'sales.order_fulfill',
  'sales.invoice_manage',
  'pos.access',
  'pos.sell',
  'pos.void',
  'pos.session_manage',
] as const

describe('phase 6 sales/POS lifecycles', () => {
  it('walks a sales order to invoiced', () => {
    expect(() => assertTransition('salesOrder', 'draft', 'confirmed')).not.toThrow()
    expect(() => assertTransition('salesOrder', 'confirmed', 'fulfilled')).not.toThrow()
    expect(() => assertTransition('salesOrder', 'fulfilled', 'invoiced')).not.toThrow()
    expect(() => assertTransition('salesOrder', 'invoiced', 'closed')).not.toThrow()
  })

  it('completes and refunds a POS sale', () => {
    expect(canTransition('posSale', 'open', 'completed')).toBe(true)
    expect(canTransition('posSale', 'completed', 'refunded')).toBe(true)
    expect(canTransition('posSale', 'open', 'voided')).toBe(true)
  })

  it('walks an invoice from issued to paid', () => {
    expect(canTransition('salesInvoice', 'draft', 'issued')).toBe(true)
    expect(canTransition('salesInvoice', 'issued', 'partially_paid')).toBe(true)
    expect(canTransition('salesInvoice', 'partially_paid', 'paid')).toBe(true)
    expect(canTransition('salesInvoice', 'issued', 'paid')).toBe(true)
  })

  it('blocks illegal sales order jumps', () => {
    expect(canTransition('salesOrder', 'draft', 'fulfilled')).toBe(false)
    expect(canTransition('posSale', 'voided', 'completed')).toBe(false)
  })
})

describe('phase 6 RBAC catalog', () => {
  it('registers and links every sales/POS permission', () => {
    for (const code of SALES_POS_PERMISSIONS) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
    }
  })

  it('grants pos_cashier the checkout surface', () => {
    const grants = ROLE_PERMISSION_MAP.pos_cashier
    expect(grants).toContain('pos.access')
    expect(grants).toContain('pos.sell')
    expect(grants).toContain('pos.session_manage')
  })

  it('grants sales_manager the order + invoice surface', () => {
    const grants = ROLE_PERMISSION_MAP.sales_manager
    for (const code of [
      'sales.order_create',
      'sales.order_fulfill',
      'sales.invoice_manage',
    ] as const) {
      expect(grants).toContain(code)
    }
  })
})
