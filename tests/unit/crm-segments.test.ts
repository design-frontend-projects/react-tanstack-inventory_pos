import { describe, expect, it } from 'vitest'
import {
  evaluateSegmentRule,
  segmentRuleSchema,
} from '#/server/crm/segment-evaluator'
import type { CustomerFacts, SegmentRuleGroup } from '#/server/crm/segment-evaluator'

function facts(overrides: Partial<CustomerFacts> = {}): CustomerFacts {
  return {
    totalSpend: 0,
    ordersCount: 0,
    avgOrderValue: 0,
    returnsCount: 0,
    visitCount: 0,
    daysSinceLastPurchase: null,
    loyaltyPoints: 0,
    lifetimePoints: 0,
    churnScore: null,
    rfmSegment: null,
    lifecycleStatus: null,
    vipLevel: 0,
    isCorporate: false,
    acquisitionChannel: null,
    ...overrides,
  }
}

describe('segment evaluator', () => {
  it('evaluates a single greater-than condition', () => {
    const rule: SegmentRuleGroup = {
      op: 'and',
      conditions: [{ field: 'totalSpend', cmp: 'gt', value: 1000 }],
    }

    expect(evaluateSegmentRule(rule, facts({ totalSpend: 1500 }))).toBe(true)
    expect(evaluateSegmentRule(rule, facts({ totalSpend: 500 }))).toBe(false)
  })

  it('AND requires every condition; OR requires any', () => {
    const highValueRecent: SegmentRuleGroup = {
      op: 'and',
      conditions: [
        { field: 'totalSpend', cmp: 'gte', value: 1000 },
        { field: 'daysSinceLastPurchase', cmp: 'lte', value: 90 },
      ],
    }

    expect(
      evaluateSegmentRule(highValueRecent, facts({ totalSpend: 2000, daysSinceLastPurchase: 30 }))
    ).toBe(true)
    expect(
      evaluateSegmentRule(highValueRecent, facts({ totalSpend: 2000, daysSinceLastPurchase: 200 }))
    ).toBe(false)

    const either: SegmentRuleGroup = {
      op: 'or',
      conditions: [
        { field: 'vipLevel', cmp: 'gte', value: 3 },
        { field: 'lifetimePoints', cmp: 'gte', value: 20000 },
      ],
    }

    expect(evaluateSegmentRule(either, facts({ vipLevel: 3 }))).toBe(true)
    expect(evaluateSegmentRule(either, facts({ lifetimePoints: 25000 }))).toBe(true)
    expect(evaluateSegmentRule(either, facts({ vipLevel: 1, lifetimePoints: 100 }))).toBe(false)
  })

  it('supports nested groups', () => {
    const rule: SegmentRuleGroup = {
      op: 'and',
      conditions: [
        { field: 'lifecycleStatus', cmp: 'eq', value: 'active' },
        {
          op: 'or',
          conditions: [
            { field: 'rfmSegment', cmp: 'eq', value: 'champion' },
            { field: 'totalSpend', cmp: 'gt', value: 5000 },
          ],
        },
      ],
    }

    expect(
      evaluateSegmentRule(rule, facts({ lifecycleStatus: 'active', rfmSegment: 'champion' }))
    ).toBe(true)
    expect(
      evaluateSegmentRule(rule, facts({ lifecycleStatus: 'active', totalSpend: 6000 }))
    ).toBe(true)
    expect(
      evaluateSegmentRule(rule, facts({ lifecycleStatus: 'inactive', rfmSegment: 'champion' }))
    ).toBe(false)
  })

  it('treats null facts as never matching a comparison', () => {
    const rule: SegmentRuleGroup = {
      op: 'and',
      conditions: [{ field: 'daysSinceLastPurchase', cmp: 'gte', value: 180 }],
    }

    expect(evaluateSegmentRule(rule, facts({ daysSinceLastPurchase: null }))).toBe(false)
  })

  it('supports in and contains comparators', () => {
    const inRule: SegmentRuleGroup = {
      op: 'and',
      conditions: [{ field: 'rfmSegment', cmp: 'in', value: ['at_risk', 'cant_lose'] }],
    }

    expect(evaluateSegmentRule(inRule, facts({ rfmSegment: 'at_risk' }))).toBe(true)
    expect(evaluateSegmentRule(inRule, facts({ rfmSegment: 'champion' }))).toBe(false)

    const containsRule: SegmentRuleGroup = {
      op: 'and',
      conditions: [{ field: 'acquisitionChannel', cmp: 'contains', value: 'instagram' }],
    }

    expect(
      evaluateSegmentRule(containsRule, facts({ acquisitionChannel: 'ads-Instagram-2026' }))
    ).toBe(true)
  })
})

describe('segment rule schema', () => {
  it('accepts a valid nested rule', () => {
    const rule = {
      op: 'or',
      conditions: [
        { field: 'totalSpend', cmp: 'gt', value: 1000 },
        { op: 'and', conditions: [{ field: 'vipLevel', cmp: 'gte', value: 2 }] },
      ],
    }

    expect(segmentRuleSchema.safeParse(rule).success).toBe(true)
  })

  it('rejects unknown fields and comparators', () => {
    expect(
      segmentRuleSchema.safeParse({
        op: 'and',
        conditions: [{ field: 'unknown_field', cmp: 'gt', value: 1 }],
      }).success
    ).toBe(false)

    expect(
      segmentRuleSchema.safeParse({
        op: 'and',
        conditions: [{ field: 'totalSpend', cmp: 'between', value: 1 }],
      }).success
    ).toBe(false)
  })

  it('rejects an empty condition list', () => {
    expect(segmentRuleSchema.safeParse({ op: 'and', conditions: [] }).success).toBe(false)
  })
})
