import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition } from '#/server/inventory/state-machine'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

const RETURN_PERMISSIONS = [
  'returns.view',
  'returns.create',
  'returns.approve',
  'returns.receive',
  'returns.refund',
  'note.manage',
] as const

describe('phase 7 sales-return lifecycle', () => {
  it('walks a return through approval to credited', () => {
    expect(() => assertTransition('salesReturn', 'draft', 'requested')).not.toThrow()
    expect(() => assertTransition('salesReturn', 'requested', 'approved')).not.toThrow()
    expect(() => assertTransition('salesReturn', 'approved', 'received')).not.toThrow()
    expect(() => assertTransition('salesReturn', 'received', 'credited')).not.toThrow()
    expect(() => assertTransition('salesReturn', 'credited', 'closed')).not.toThrow()
  })

  it('allows in-transit before receiving', () => {
    expect(canTransition('salesReturn', 'approved', 'in_transit')).toBe(true)
    expect(canTransition('salesReturn', 'in_transit', 'received')).toBe(true)
  })

  it('blocks illegal return jumps', () => {
    // A draft cannot be received without approval.
    expect(canTransition('salesReturn', 'draft', 'received')).toBe(false)
    // A rejected/cancelled return is terminal.
    expect(canTransition('salesReturn', 'rejected', 'approved')).toBe(false)
    expect(canTransition('salesReturn', 'cancelled', 'received')).toBe(false)
  })
})

describe('phase 7 POS refund status flow', () => {
  it('moves a completed sale to partially- or fully-refunded', () => {
    expect(canTransition('posSale', 'completed', 'partially_refunded')).toBe(true)
    expect(canTransition('posSale', 'completed', 'refunded')).toBe(true)
    expect(canTransition('posSale', 'partially_refunded', 'refunded')).toBe(true)
  })

  it('will not refund a voided sale', () => {
    expect(canTransition('posSale', 'voided', 'refunded')).toBe(false)
    expect(canTransition('posSale', 'refunded', 'partially_refunded')).toBe(false)
  })
})

describe('phase 7 credit/debit note lifecycle', () => {
  it('issues, applies, and closes a note', () => {
    expect(() => assertTransition('note', 'draft', 'issued')).not.toThrow()
    expect(() => assertTransition('note', 'issued', 'applied')).not.toThrow()
    expect(() => assertTransition('note', 'applied', 'closed')).not.toThrow()
  })

  it('blocks illegal note jumps', () => {
    expect(canTransition('note', 'draft', 'applied')).toBe(false)
    expect(canTransition('note', 'applied', 'cancelled')).toBe(false)
  })
})

describe('phase 7 RBAC catalog', () => {
  it('registers and links every return/note permission', () => {
    for (const code of RETURN_PERMISSIONS) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
    }
  })

  it('grants pos_cashier the refund surface but not approval', () => {
    const grants = ROLE_PERMISSION_MAP.pos_cashier
    expect(grants).toContain('returns.refund')
    expect(grants).toContain('returns.view')
    expect(grants).not.toContain('returns.approve')
  })

  it('grants sales_manager the full return + note surface', () => {
    const grants = ROLE_PERMISSION_MAP.sales_manager
    for (const code of RETURN_PERMISSIONS) {
      expect(grants).toContain(code)
    }
  })

  it('grants purchasing_officer debit-note management', () => {
    expect(ROLE_PERMISSION_MAP.purchasing_officer).toContain('note.manage')
  })
})
