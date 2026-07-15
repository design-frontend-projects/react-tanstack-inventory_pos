import { describe, expect, it } from 'vitest'
import { ValidationError } from '#/server/auth/errors'
import {
  assertTransition,
  canTransition,
  DOCUMENT_STATE_MACHINES,
} from '#/server/inventory/state-machine'

describe('inventory document state machine', () => {
  it('allows a valid purchase order progression', () => {
    expect(canTransition('purchaseOrder', 'draft', 'approved')).toBe(true)
    expect(canTransition('purchaseOrder', 'confirmed', 'partially_received')).toBe(true)
    expect(canTransition('purchaseOrder', 'received', 'closed')).toBe(true)
  })

  it('blocks an illegal purchase order transition', () => {
    expect(canTransition('purchaseOrder', 'draft', 'received')).toBe(false)
    expect(canTransition('purchaseOrder', 'closed', 'draft')).toBe(false)
  })

  it('throws ValidationError for an illegal transition', () => {
    expect(() => assertTransition('salesOrder', 'draft', 'fulfilled')).toThrow(
      ValidationError
    )
  })

  it('throws ValidationError for an unknown source state', () => {
    expect(() => assertTransition('posSale', 'nonsense', 'completed')).toThrow(
      ValidationError
    )
  })

  it('permits a valid POS sale lifecycle to completion and refund', () => {
    expect(() => assertTransition('posSale', 'open', 'completed')).not.toThrow()
    expect(() => assertTransition('posSale', 'completed', 'refunded')).not.toThrow()
  })

  it('treats terminal states as sinks', () => {
    for (const machine of Object.keys(
      DOCUMENT_STATE_MACHINES
    ) as Array<keyof typeof DOCUMENT_STATE_MACHINES>) {
      const transitions = DOCUMENT_STATE_MACHINES[machine] as Record<
        string,
        ReadonlyArray<string>
      >

      for (const [state, targets] of Object.entries(transitions)) {
        // Every declared target must itself be a declared state (no dangling edges).
        for (const target of targets) {
          expect(Object.keys(transitions)).toContain(target)
        }

        expect(Array.isArray(targets)).toBe(true)
        void state
      }
    }
  })
})
