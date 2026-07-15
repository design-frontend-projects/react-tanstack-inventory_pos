import { describe, expect, it } from 'vitest'
import { computeReorderSuggestion } from '#/server/inventory/reorder-logic'
import { aggregateValuation } from '#/server/inventory/valuation-logic'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

describe('phase 11 reorder logic', () => {
  it('suggests the reorder quantity when available is at or below the point', () => {
    const s = computeReorderSuggestion(8, 0, { reorderPoint: 10, reorderQty: 50, maxStock: 0 })
    expect(s.belowPoint).toBe(true)
    expect(s.suggestedQty.toString()).toBe('50')
    expect(s.available.toString()).toBe('8')
  })

  it('nets reservations out of available before comparing', () => {
    // on-hand 20, reserved 15 → available 5 ≤ point 10
    const s = computeReorderSuggestion(20, 15, { reorderPoint: 10, reorderQty: 30, maxStock: 0 })
    expect(s.available.toString()).toBe('5')
    expect(s.belowPoint).toBe(true)
    expect(s.suggestedQty.toString()).toBe('30')
  })

  it('tops up to max stock when no reorder qty is configured', () => {
    const s = computeReorderSuggestion(4, 0, { reorderPoint: 10, reorderQty: 0, maxStock: 25 })
    expect(s.suggestedQty.toString()).toBe('21')
  })

  it('suggests nothing when comfortably above the point', () => {
    const s = computeReorderSuggestion(100, 0, { reorderPoint: 10, reorderQty: 50, maxStock: 0 })
    expect(s.belowPoint).toBe(false)
    expect(s.suggestedQty.toString()).toBe('0')
  })
})

describe('phase 11 valuation aggregation', () => {
  it('rolls up on-hand, total value, and blended WAC', () => {
    const totals = aggregateValuation([
      { onHand: 10, totalValue: 30 },
      { onHand: 5, totalValue: 25 },
    ])
    expect(totals.onHand.toString()).toBe('15')
    expect(totals.totalValue.toString()).toBe('55')
    // 55 / 15 = 3.6666...
    expect(totals.avgUnitCost.toNumber()).toBeCloseTo(3.6667, 3)
  })

  it('is zero-safe on an empty book', () => {
    const totals = aggregateValuation([])
    expect(totals.onHand.toString()).toBe('0')
    expect(totals.avgUnitCost.toString()).toBe('0')
  })
})

describe('phase 11 RBAC', () => {
  it('registers and links reorder/valuation permissions', () => {
    for (const code of ['inventory.manage_reorder', 'inventory.view_valuation'] as const) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
    }
  })

  it('grants reorder + valuation to inventory + warehouse managers', () => {
    for (const role of ['inventory_manager', 'warehouse_manager'] as const) {
      expect(ROLE_PERMISSION_MAP[role]).toContain('inventory.manage_reorder')
      expect(ROLE_PERMISSION_MAP[role]).toContain('inventory.view_valuation')
    }
  })
})
