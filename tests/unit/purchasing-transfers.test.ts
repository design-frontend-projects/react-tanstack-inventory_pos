import { describe, expect, it } from 'vitest'
import {
  assertTransition,
  canTransition,
} from '#/server/inventory/state-machine'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

const PURCHASING_PERMISSIONS = [
  'transfer.view',
  'transfer.create',
  'transfer.ship',
  'transfer.receive',
  'purchase.requisition_view',
  'purchase.requisition_manage',
  'purchase.po_view',
  'purchase.po_create',
  'purchase.po_approve',
  'purchase.po_receive',
  'purchase.return_manage',
] as const

describe('phase 4/5 document lifecycles', () => {
  it('walks a purchase order through its full lifecycle', () => {
    expect(() =>
      assertTransition('purchaseOrder', 'draft', 'approved'),
    ).not.toThrow()
    expect(() =>
      assertTransition('purchaseOrder', 'approved', 'confirmed'),
    ).not.toThrow()
    expect(() =>
      assertTransition('purchaseOrder', 'confirmed', 'partially_received'),
    ).not.toThrow()
    expect(() =>
      assertTransition('purchaseOrder', 'partially_received', 'received'),
    ).not.toThrow()
    expect(() =>
      assertTransition('purchaseOrder', 'received', 'closed'),
    ).not.toThrow()
  })

  it('allows single-step posting for receipts, transfers, and returns', () => {
    expect(canTransition('goodsReceipt', 'draft', 'completed')).toBe(true)
    expect(canTransition('stockTransfer', 'draft', 'shipped')).toBe(true)
    expect(canTransition('purchaseReturn', 'draft', 'shipped')).toBe(true)
  })

  it('supports the two-leg transfer path ship -> in_transit -> received', () => {
    expect(canTransition('stockTransfer', 'shipped', 'in_transit')).toBe(true)
    expect(canTransition('stockTransfer', 'in_transit', 'received')).toBe(true)
    expect(canTransition('stockTransfer', 'received', 'closed')).toBe(true)
  })

  it('blocks illegal purchase order jumps', () => {
    expect(canTransition('purchaseOrder', 'draft', 'received')).toBe(false)
    expect(canTransition('purchaseOrder', 'closed', 'draft')).toBe(false)
  })
})

describe('phase 4/5 RBAC catalog', () => {
  it('registers and links every transfer/purchase permission', () => {
    for (const code of PURCHASING_PERMISSIONS) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
      // transfers stay under inventory; purchase codes now belong to the
      // dedicated `purchase` module (Spec 005).
      const expectedModule = code.startsWith('purchase.')
        ? 'purchase'
        : 'inventory'
      expect(PERMISSION_LINKS[code].moduleCode).toBe(expectedModule)
    }
  })

  it('registers and links the Spec 005 procurement permissions', () => {
    for (const code of [
      'purchase.rfq_manage',
      'purchase.quotation_award',
      'purchase.invoice_manage',
      'purchase.invoice_match',
      'purchase.payment_manage',
      'purchase.landed_cost_manage',
      'purchase.debit_note_manage',
      'purchase.approval_action',
      'purchase.config_manage',
    ] as const) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
      expect(PERMISSION_LINKS[code].moduleCode).toBe('purchase')
    }
  })

  it('grants the purchasing_officer role the full purchasing surface', () => {
    const grants = ROLE_PERMISSION_MAP.purchasing_officer

    for (const code of [
      'purchase.requisition_manage',
      'purchase.po_create',
      'purchase.po_approve',
      'purchase.po_receive',
      'purchase.return_manage',
      'purchase.rfq_manage',
      'purchase.quotation_award',
      'purchase.invoice_manage',
      'purchase.payment_manage',
      'purchase.landed_cost_manage',
    ] as const) {
      expect(grants).toContain(code)
    }
  })

  it('grants warehouse_manager transfer ship/receive and goods receipt', () => {
    const grants = ROLE_PERMISSION_MAP.warehouse_manager
    expect(grants).toContain('transfer.ship')
    expect(grants).toContain('transfer.receive')
    expect(grants).toContain('purchase.po_receive')
  })
})
