import { describe, expect, it } from 'vitest'
import {
  resolvePrice,
  ruleApplies,
} from '#/server/restaurant/menu/pricing-resolver'
import type { PriceRuleInput } from '#/server/restaurant/menu/pricing-resolver'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'
import { PERMISSION_DEFINITIONS, ROLE_PERMISSION_MAP } from '#/features/auth/rbac-catalog'

// A Tuesday 17:00 local time reference (2026-07-14 is a Tuesday).
const TUESDAY_1700 = new Date(2026, 6, 14, 17, 0, 0)
const TUESDAY_2000 = new Date(2026, 6, 14, 20, 0, 0)
const SATURDAY_1200 = new Date(2026, 6, 18, 12, 0, 0)

function rule(overrides: Partial<PriceRuleInput> & { id: string; amount: string }): PriceRuleInput {
  return {
    priceType: 'BASE',
    priority: 0,
    serviceTypeId: null,
    channel: null,
    scheduleJson: null,
    startsAt: null,
    endsAt: null,
    ...overrides,
  }
}

describe('menu pricing resolver — applicability', () => {
  it('falls back to base price when no rules apply', () => {
    const result = resolvePrice('20.00', [], { now: TUESDAY_1700 })
    expect(result.amount).toBe('20.00')
    expect(result.appliedRuleId).toBeNull()
    expect(result.priceType).toBe('BASE')
  })

  it('applies a happy-hour window and drops it outside the window', () => {
    const happy = rule({
      id: 'hh',
      amount: '12.00',
      priceType: 'HAPPY_HOUR',
      priority: 10,
      scheduleJson: { weekdays: [2, 3, 4], from: '16:00', to: '18:00' },
    })
    expect(resolvePrice('20.00', [happy], { now: TUESDAY_1700 }).amount).toBe('12.00')
    expect(resolvePrice('20.00', [happy], { now: TUESDAY_2000 }).appliedRuleId).toBeNull()
    expect(resolvePrice('20.00', [happy], { now: SATURDAY_1200 }).appliedRuleId).toBeNull()
  })

  it('respects service type and channel constraints', () => {
    const delivery = rule({
      id: 'del',
      amount: '25.00',
      priceType: 'DELIVERY',
      serviceTypeId: 'svc-delivery',
      priority: 5,
    })
    expect(ruleApplies(delivery, { now: TUESDAY_1700, serviceTypeId: 'svc-delivery' })).toBe(true)
    expect(ruleApplies(delivery, { now: TUESDAY_1700, serviceTypeId: 'svc-dinein' })).toBe(false)
  })

  it('honours date validity windows', () => {
    const seasonal = rule({
      id: 'ram',
      amount: '15.00',
      priority: 3,
      startsAt: new Date(2026, 6, 1),
      endsAt: new Date(2026, 6, 10),
    })
    expect(ruleApplies(seasonal, { now: TUESDAY_1700 })).toBe(false) // 14th > 10th
    expect(ruleApplies(seasonal, { now: new Date(2026, 6, 5) })).toBe(true)
  })

  it('supports overnight windows that wrap past midnight', () => {
    const lateNight = rule({
      id: 'ln',
      amount: '9.00',
      scheduleJson: { from: '22:00', to: '02:00' },
    })
    expect(ruleApplies(lateNight, { now: new Date(2026, 6, 14, 23, 30) })).toBe(true)
    expect(ruleApplies(lateNight, { now: new Date(2026, 6, 14, 1, 30) })).toBe(true)
    expect(ruleApplies(lateNight, { now: new Date(2026, 6, 14, 12, 0) })).toBe(false)
  })
})

describe('menu pricing resolver — conflict resolution', () => {
  it('picks the highest-priority applicable rule', () => {
    const rules = [
      rule({ id: 'a', amount: '18.00', priority: 1 }),
      rule({ id: 'b', amount: '16.00', priority: 5 }),
    ]
    expect(resolvePrice('20.00', rules, { now: TUESDAY_1700 }).appliedRuleId).toBe('b')
  })

  it('breaks priority ties by specificity, then lower amount', () => {
    const generic = rule({ id: 'g', amount: '17.00', priority: 5 })
    const specific = rule({
      id: 's',
      amount: '17.50',
      priority: 5,
      serviceTypeId: 'svc-dinein',
    })
    const result = resolvePrice('20.00', [generic, specific], {
      now: TUESDAY_1700,
      serviceTypeId: 'svc-dinein',
    })
    expect(result.appliedRuleId).toBe('s') // more specific wins the tie
  })
})

describe('menu RBAC registration', () => {
  it('registers the new menu permissions in both catalogs', () => {
    const codes = PERMISSION_DEFINITIONS.map((p) => p.code)
    expect(codes).toContain('res.menu.view')
    expect(codes).toContain('res.menu.manage')
    expect(PERMISSION_LINKS['res.menu.view'].moduleCode).toBe('restaurant')
    expect(PERMISSION_LINKS['res.menu.manage'].kind).toBe('action')
  })

  it('grants menu management to res:admin and view to res:kitchen', () => {
    expect(ROLE_PERMISSION_MAP['res:admin']).toContain('res.menu.manage')
    expect(ROLE_PERMISSION_MAP['res:kitchen']).toContain('res.menu.view')
    expect(ROLE_PERMISSION_MAP['res:kitchen']).not.toContain('res.menu.manage')
  })
})
