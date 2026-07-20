import { describe, expect, it } from 'vitest'
import {
  evaluatePromotions,
  matchesConditions,
} from '#/server/restaurant/promotions/promotion-engine'
import type {
  PromotionCart,
  PromotionRule,
} from '#/server/restaurant/promotions/promotion-engine'

const CART: PromotionCart = {
  subtotal: '100.00',
  channel: 'POS',
  orderType: 'DINE_IN',
  customerId: null,
  items: [
    {
      menuItemId: 'burger',
      categoryId: 'mains',
      quantity: 2,
      unitPrice: '30.00',
      lineTotal: '60.00',
    },
    {
      menuItemId: 'cola',
      categoryId: 'drinks',
      quantity: 4,
      unitPrice: '10.00',
      lineTotal: '40.00',
    },
  ],
}

function rule(overrides: Partial<PromotionRule>): PromotionRule {
  return {
    id: 'p1',
    name: 'Test promo',
    kind: 'PERCENT',
    priority: 10,
    stacking: 'STACKABLE',
    conditions: {},
    action: { type: 'PERCENT', value: '10' },
    ...overrides,
  }
}

// Fixed evaluation instant: Wednesday 19:30 local.
const WEDNESDAY_EVENING = new Date(2026, 6, 15, 19, 30)

describe('matchesConditions', () => {
  it('matches an empty condition set', () => {
    expect(matchesConditions(CART, {}, WEDNESDAY_EVENING)).toBe(true)
  })

  it('enforces minimum subtotal', () => {
    expect(
      matchesConditions(CART, { minSubtotal: '150' }, WEDNESDAY_EVENING),
    ).toBe(false)
    expect(
      matchesConditions(CART, { minSubtotal: '99' }, WEDNESDAY_EVENING),
    ).toBe(true)
  })

  it('filters by channel and order type', () => {
    expect(
      matchesConditions(CART, { channels: ['QR'] }, WEDNESDAY_EVENING),
    ).toBe(false)
    expect(
      matchesConditions(
        CART,
        { channels: ['POS'], orderTypes: ['DINE_IN'] },
        WEDNESDAY_EVENING,
      ),
    ).toBe(true)
  })

  it('requires a qualifying item with minimum quantity', () => {
    expect(
      matchesConditions(
        CART,
        { itemIds: ['burger'], minQuantity: 3 },
        WEDNESDAY_EVENING,
      ),
    ).toBe(false)
    expect(
      matchesConditions(
        CART,
        { itemIds: ['cola'], minQuantity: 3 },
        WEDNESDAY_EVENING,
      ),
    ).toBe(true)
  })

  it('honors happy-hour time windows and days', () => {
    const happyHour = {
      timeWindow: { startMinute: 17 * 60, endMinute: 20 * 60, daysOfWeek: [3] },
    }
    expect(matchesConditions(CART, happyHour, WEDNESDAY_EVENING)).toBe(true)
    const monday = new Date(2026, 6, 13, 19, 30)
    expect(matchesConditions(CART, happyHour, monday)).toBe(false)
    const lateNight = new Date(2026, 6, 15, 22, 0)
    expect(matchesConditions(CART, happyHour, lateNight)).toBe(false)
  })
})

describe('evaluatePromotions', () => {
  it('applies a percent discount on the subtotal', () => {
    const result = evaluatePromotions(
      CART,
      [rule({ action: { type: 'PERCENT', value: '10' } })],
      WEDNESDAY_EVENING,
    )
    expect(result.applications).toHaveLength(1)
    expect(result.applications[0].discount).toBe('10.00')
    expect(result.totalDiscount).toBe('10.00')
  })

  it('applies a fixed discount capped at the subtotal', () => {
    const result = evaluatePromotions(
      CART,
      [rule({ kind: 'FIXED', action: { type: 'FIXED', value: '150' } })],
      WEDNESDAY_EVENING,
    )
    expect(result.applications[0].discount).toBe('100.00')
  })

  it('skips promotions whose conditions fail', () => {
    const result = evaluatePromotions(
      CART,
      [rule({ conditions: { minSubtotal: '500' } })],
      WEDNESDAY_EVENING,
    )
    expect(result.applications).toHaveLength(0)
    expect(result.totalDiscount).toBe('0.00')
  })

  it('stacks stackable promotions in priority order', () => {
    const result = evaluatePromotions(
      CART,
      [
        rule({ id: 'a', priority: 5, action: { type: 'PERCENT', value: '10' } }),
        rule({ id: 'b', priority: 20, action: { type: 'FIXED', value: '5' } }),
      ],
      WEDNESDAY_EVENING,
    )
    // Higher priority evaluates first but both apply.
    expect(result.applications.map((app) => app.promotionId)).toEqual(['b', 'a'])
    expect(result.totalDiscount).toBe('15.00')
  })

  it('an exclusive promotion suppresses all others', () => {
    const result = evaluatePromotions(
      CART,
      [
        rule({ id: 'a', priority: 5, action: { type: 'PERCENT', value: '10' } }),
        rule({
          id: 'exclusive',
          priority: 50,
          stacking: 'EXCLUSIVE',
          action: { type: 'PERCENT', value: '20' },
        }),
      ],
      WEDNESDAY_EVENING,
    )
    expect(result.applications).toHaveLength(1)
    expect(result.applications[0].promotionId).toBe('exclusive')
    expect(result.totalDiscount).toBe('20.00')
  })

  it('BOGO grants the cheapest qualifying units free', () => {
    const result = evaluatePromotions(
      CART,
      [
        rule({
          id: 'bogo',
          kind: 'BOGO',
          action: {
            type: 'BOGO',
            buyItemIds: ['cola'],
            buyQuantity: 2,
            getQuantity: 1,
          },
        }),
      ],
      WEDNESDAY_EVENING,
    )
    // 4 colas → 2 free (one per pair), at 10.00 each.
    expect(result.applications[0].discount).toBe('20.00')
  })

  it('total discount never exceeds the subtotal', () => {
    const result = evaluatePromotions(
      CART,
      [
        rule({ id: 'a', action: { type: 'FIXED', value: '80' } }),
        rule({ id: 'b', priority: 5, action: { type: 'FIXED', value: '50' } }),
      ],
      WEDNESDAY_EVENING,
    )
    expect(result.totalDiscount).toBe('100.00')
  })
})
