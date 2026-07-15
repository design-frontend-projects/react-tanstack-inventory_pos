import { describe, expect, it } from 'vitest'
import { computeChurnScore } from '#/server/crm/churn-heuristics'
import {
  averageOrderValue,
  emptyMetricsFacts,
  estimateClv,
  foldEvent,
  topKey,
} from '#/server/crm/metrics-fold'
import type { MetricsFacts } from '#/server/crm/metrics-fold'
import { labelRfmSegment, scoreRfm } from '#/server/crm/rfm-scoring'

function saleEvent(grandTotal: string, occurredAt: Date, overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'pos_sale.completed',
    occurredAt,
    payloadJson: {
      grandTotal,
      warehouseId: 'wh-1',
      paymentMethods: ['CARD'],
      lines: [{ productId: 'p-1' }],
      ...overrides,
    },
  }
}

describe('metrics fold', () => {
  it('accumulates spend, orders, visits, and first/last purchase', () => {
    let facts = emptyMetricsFacts()

    facts = foldEvent(facts, saleEvent('100.00', new Date('2026-01-01')))!
    facts = foldEvent(facts, saleEvent('50.00', new Date('2026-02-01')))!

    expect(facts.ordersCount).toBe(2)
    expect(facts.totalSpend.toString()).toBe('150')
    expect(facts.visitCount).toBe(2)
    expect(facts.firstPurchaseAt).toEqual(new Date('2026-01-01'))
    expect(facts.lastPurchaseAt).toEqual(new Date('2026-02-01'))
    expect(averageOrderValue(facts).toString()).toBe('75')
  })

  it('does not move firstPurchaseAt backward and tracks the latest purchase', () => {
    let facts = emptyMetricsFacts()
    facts = foldEvent(facts, saleEvent('100', new Date('2026-05-01')))!
    facts = foldEvent(facts, saleEvent('100', new Date('2026-03-01')))!

    expect(facts.firstPurchaseAt).toEqual(new Date('2026-05-01'))
    expect(facts.lastPurchaseAt).toEqual(new Date('2026-05-01'))
  })

  it('folds refunds into returns count and value', () => {
    let facts = emptyMetricsFacts()
    facts = foldEvent(facts, saleEvent('200', new Date('2026-01-01')))!
    facts = foldEvent(facts, {
      eventType: 'pos_sale.refunded',
      occurredAt: new Date('2026-01-05'),
      payloadJson: { amount: '40' },
    })!

    expect(facts.returnsCount).toBe(1)
    expect(facts.returnsValue.toString()).toBe('40')
    // Refunds do not reduce the order count or total spend (gross metrics).
    expect(facts.ordersCount).toBe(1)
  })

  it('ignores non-metrics events', () => {
    expect(
      foldEvent(emptyMetricsFacts(), {
        eventType: 'customer.updated',
        occurredAt: new Date(),
        payloadJson: {},
      })
    ).toBeNull()
  })

  it('picks the most frequent favorite', () => {
    let facts = emptyMetricsFacts()
    facts = foldEvent(facts, saleEvent('10', new Date('2026-01-01'), { lines: [{ productId: 'a' }] }))!
    facts = foldEvent(facts, saleEvent('10', new Date('2026-01-02'), { lines: [{ productId: 'b' }] }))!
    facts = foldEvent(facts, saleEvent('10', new Date('2026-01-03'), { lines: [{ productId: 'b' }] }))!

    expect(topKey(facts.favorites.products)).toBe('b')
  })

  it('is order-independent for spend totals (idempotent fold check)', () => {
    const events = [
      saleEvent('33.33', new Date('2026-01-01')),
      saleEvent('66.67', new Date('2026-01-02')),
      saleEvent('100.00', new Date('2026-01-03')),
    ]

    const forward = events.reduce<MetricsFacts>(
      (facts, event) => foldEvent(facts, event)!,
      emptyMetricsFacts()
    )
    const reverse = [...events]
      .reverse()
      .reduce<MetricsFacts>((facts, event) => foldEvent(facts, event)!, emptyMetricsFacts())

    expect(forward.totalSpend.toString()).toBe(reverse.totalSpend.toString())
    expect(forward.totalSpend.toString()).toBe('200')
  })
})

describe('estimateClv', () => {
  it('projects annualized spend over a 3-year horizon', () => {
    let facts = emptyMetricsFacts()
    facts = foldEvent(facts, saleEvent('365', new Date('2026-01-01')))!
    // 365 spent over 365 days = 1/day → 1 × 365 × 3 = 1095.
    const clv = estimateClv(facts, new Date('2027-01-01'))

    expect(Number(clv.toString())).toBeCloseTo(1095, 0)
  })

  it('is zero before any purchase', () => {
    expect(estimateClv(emptyMetricsFacts(), new Date()).toString()).toBe('0')
  })
})

describe('rfm scoring', () => {
  it('scores a recent frequent high spender as a champion', () => {
    const score = scoreRfm({
      lastPurchaseAt: new Date('2026-07-14'),
      ordersCount: 30,
      totalSpend: 8000,
      now: new Date('2026-07-15'),
    })

    expect(score).toEqual({ recency: 5, frequency: 5, monetary: 5, segment: 'champion' })
  })

  it('scores a lapsed customer as at risk or hibernating', () => {
    const score = scoreRfm({
      lastPurchaseAt: new Date('2026-01-01'),
      ordersCount: 12,
      totalSpend: 3000,
      now: new Date('2026-07-15'),
    })

    expect(score?.recency).toBe(1)
    expect(score?.segment).toBe('cant_lose')
  })

  it('returns null for customers with no purchases', () => {
    expect(
      scoreRfm({ lastPurchaseAt: null, ordersCount: 0, totalSpend: 0, now: new Date() })
    ).toBeNull()
  })

  it('labels segments from R/F/M scores deterministically', () => {
    expect(labelRfmSegment(5, 5, 5)).toBe('champion')
    expect(labelRfmSegment(5, 1, 1)).toBe('new')
    expect(labelRfmSegment(2, 4, 4)).toBe('at_risk')
    expect(labelRfmSegment(1, 1, 1)).toBe('hibernating')
  })
})

describe('churn heuristic', () => {
  it('is null before any purchase', () => {
    expect(
      computeChurnScore({
        firstPurchaseAt: null,
        lastPurchaseAt: null,
        ordersCount: 0,
        now: new Date(),
      })
    ).toBeNull()
  })

  it('scores ~0.5 when a customer is exactly one interval overdue', () => {
    // Two purchases 30 days apart → expected interval 30 days. 30 days since last → ratio 1 → 0.5.
    const score = computeChurnScore({
      firstPurchaseAt: new Date('2026-06-01'),
      lastPurchaseAt: new Date('2026-07-01'),
      ordersCount: 2,
      now: new Date('2026-07-31'),
    })

    expect(score).toBeCloseTo(0.5, 2)
  })

  it('rises toward 1 the longer a customer is overdue', () => {
    const recent = computeChurnScore({
      firstPurchaseAt: new Date('2026-06-01'),
      lastPurchaseAt: new Date('2026-07-10'),
      ordersCount: 5,
      now: new Date('2026-07-15'),
    })!
    const lapsed = computeChurnScore({
      firstPurchaseAt: new Date('2026-06-01'),
      lastPurchaseAt: new Date('2026-07-10'),
      ordersCount: 5,
      now: new Date('2026-12-15'),
    })!

    expect(lapsed).toBeGreaterThan(recent)
    expect(lapsed).toBeLessThan(1)
  })
})
