import { describe, expect, it } from 'vitest'
import { availableBalance, computeLeaveDays } from '#/server/hr/leave-calc'

describe('computeLeaveDays', () => {
  it('counts inclusive calendar days', () => {
    expect(
      computeLeaveDays(new Date('2026-03-02'), new Date('2026-03-06')),
    ).toBe(5)
  })

  it('returns 1 for a same-day request', () => {
    expect(
      computeLeaveDays(new Date('2026-03-02'), new Date('2026-03-02')),
    ).toBe(1)
  })

  it('returns 0.5 for a half day regardless of dates', () => {
    expect(
      computeLeaveDays(new Date('2026-03-02'), new Date('2026-03-02'), true),
    ).toBe(0.5)
  })

  it('returns 0 when the end precedes the start', () => {
    expect(
      computeLeaveDays(new Date('2026-03-06'), new Date('2026-03-02')),
    ).toBe(0)
  })
})

describe('availableBalance', () => {
  it('subtracts pending holds from the balance', () => {
    expect(availableBalance({ balanceDays: 20, pendingDays: 5 })).toBe(15)
  })

  it('accepts decimal strings', () => {
    expect(availableBalance({ balanceDays: '12.5', pendingDays: '2.5' })).toBe(10)
  })
})
