import { describe, expect, it } from 'vitest'
import {
  explodeComponentQty,
  rollupOutputUnitCost,
} from '#/server/inventory/production-costing'
import { assertTransition, canTransition } from '#/server/inventory/state-machine'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

const PRODUCTION_PERMISSIONS = [
  'production.view',
  'production.manage_bom',
  'production.create',
  'production.release',
  'production.consume',
  'production.complete',
] as const

describe('phase 10 production costing', () => {
  it('explodes a component scaled by run size and scrap', () => {
    // 2 per output, 5% scrap, run of 10 against a BOM yielding 1 → 2 * 10 * 1.05 = 21
    expect(explodeComponentQty(2, 0.05, 10, 1).toString()).toBe('21')
    // BOM yields 5 → scale is 10/5 = 2 → 3 * 2 * 1 = 6
    expect(explodeComponentQty(3, 0, 10, 5).toString()).toBe('6')
  })

  it('rolls finished-good unit cost from material + overhead / produced qty', () => {
    // (100 material + 20 overhead) / 10 units = 12.0
    expect(rollupOutputUnitCost(100, 20, 10).toString()).toBe('12')
    // zero produced yields zero (no divide-by-zero)
    expect(rollupOutputUnitCost(100, 20, 0).toString()).toBe('0')
  })

  it('rejects a non-positive BOM output quantity', () => {
    expect(() => explodeComponentQty(2, 0, 10, 0)).toThrow()
  })
})

describe('phase 10 production-order lifecycle', () => {
  it('walks an order from draft to closed', () => {
    expect(() => assertTransition('productionOrder', 'draft', 'planned')).not.toThrow()
    expect(() => assertTransition('productionOrder', 'planned', 'released')).not.toThrow()
    expect(() => assertTransition('productionOrder', 'released', 'in_progress')).not.toThrow()
    expect(() => assertTransition('productionOrder', 'in_progress', 'completed')).not.toThrow()
    expect(() => assertTransition('productionOrder', 'completed', 'closed')).not.toThrow()
  })

  it('blocks illegal production jumps', () => {
    expect(canTransition('productionOrder', 'draft', 'completed')).toBe(false)
    expect(canTransition('productionOrder', 'cancelled', 'released')).toBe(false)
  })
})

describe('phase 10 RBAC', () => {
  it('registers and links every production permission', () => {
    for (const code of PRODUCTION_PERMISSIONS) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
    }
  })

  it('grants the full production surface to production_manager', () => {
    const grants = ROLE_PERMISSION_MAP.production_manager
    for (const code of PRODUCTION_PERMISSIONS) {
      expect(grants).toContain(code)
    }
    // and the lot/serial management it needs for tracked outputs
    expect(grants).toContain('inventory.manage_lots')
  })
})
