import { describe, expect, it } from 'vitest'
import { computeRecipeCost } from '#/server/restaurant/recipes/recipe-cost'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'
import { PERMISSION_DEFINITIONS, ROLE_PERMISSION_MAP } from '#/features/auth/rbac-catalog'

describe('recipe cost calculation', () => {
  it('sums quantity × (1 + waste) × unit cost across mandatory lines', () => {
    const result = computeRecipeCost([
      { quantity: '0.2', wastePercent: '0', unitCost: '10' }, // 2.00
      { quantity: '0.1', wastePercent: '0.1', unitCost: '20' }, // 0.1*1.1*20 = 2.20
    ])
    expect(result.totalCost).toBe('4.2')
    expect(result.optionalCost).toBe('0')
  })

  it('excludes optional lines from the mandatory total', () => {
    const result = computeRecipeCost([
      { quantity: '1', wastePercent: '0', unitCost: '5' },
      { quantity: '1', wastePercent: '0', unitCost: '3', isOptional: true },
    ])
    expect(result.totalCost).toBe('5')
    expect(result.optionalCost).toBe('3')
  })

  it('adds sub-recipe cost as quantity × child cost', () => {
    const result = computeRecipeCost(
      [{ quantity: '1', wastePercent: '0', unitCost: '4' }],
      [{ quantity: '2', cost: '1.5' }]
    )
    expect(result.totalCost).toBe('7') // 4 + 2*1.5
  })

  it('handles an empty recipe', () => {
    expect(computeRecipeCost([]).totalCost).toBe('0')
  })

  it('preserves decimal precision with waste factors', () => {
    const result = computeRecipeCost([
      { quantity: '0.333', wastePercent: '0.05', unitCost: '12.5' },
    ])
    // 0.333 * 1.05 * 12.5 = 4.370625
    expect(result.totalCost).toBe('4.370625')
  })
})

describe('recipe RBAC registration', () => {
  it('registers recipe permissions in both catalogs', () => {
    const codes = PERMISSION_DEFINITIONS.map((p) => p.code)
    expect(codes).toContain('res.recipe.view')
    expect(codes).toContain('res.recipe.manage')
    expect(PERMISSION_LINKS['res.recipe.manage'].moduleCode).toBe('restaurant')
  })

  it('grants recipe management to res:admin', () => {
    expect(ROLE_PERMISSION_MAP['res:admin']).toContain('res.recipe.manage')
  })
})
