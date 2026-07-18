import { describe, expect, it } from 'vitest'
import {
  assertPeriodOpenForPosting,
  generatePeriods,
  yearEndDate
  
} from '#/server/finance/period-resolution'
import type {ResolvablePeriod} from '#/server/finance/period-resolution';

const period = (
  overrides: Partial<ResolvablePeriod> = {},
): ResolvablePeriod => ({
  id: 'p1',
  statusCode: 'open',
  isAdjustmentPeriod: false,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-01-31'),
  moduleLocks: [],
  ...overrides,
})

describe('assertPeriodOpenForPosting', () => {
  it('accepts an open, unlocked period', () => {
    expect(() =>
      assertPeriodOpenForPosting(period(), new Date('2026-01-15')),
    ).not.toThrow()
  })

  it('rejects a missing period', () => {
    expect(() =>
      assertPeriodOpenForPosting(null, new Date('2026-01-15')),
    ).toThrow(/No fiscal period/)
  })

  it('rejects closed and locked periods', () => {
    expect(() =>
      assertPeriodOpenForPosting(
        period({ statusCode: 'closed' }),
        new Date('2026-01-15'),
      ),
    ).toThrow(/closed/)

    expect(() =>
      assertPeriodOpenForPosting(
        period({ statusCode: 'locked' }),
        new Date('2026-01-15'),
      ),
    ).toThrow(/locked/)
  })

  it('rejects adjustment periods unless explicitly allowed', () => {
    const adjustment = period({ isAdjustmentPeriod: true })

    expect(() =>
      assertPeriodOpenForPosting(adjustment, new Date('2026-01-15')),
    ).toThrow(/Adjustment/)

    expect(() =>
      assertPeriodOpenForPosting(adjustment, new Date('2026-01-15'), {
        allowAdjustmentPeriod: true,
      }),
    ).not.toThrow()
  })

  it('enforces module locks', () => {
    const locked = period({ moduleLocks: [{ moduleCode: 'ap' }] })

    expect(() =>
      assertPeriodOpenForPosting(locked, new Date('2026-01-15'), {
        moduleCode: 'ap',
      }),
    ).toThrow(/locked for module/)

    expect(() =>
      assertPeriodOpenForPosting(locked, new Date('2026-01-15'), {
        moduleCode: 'gl',
      }),
    ).not.toThrow()
  })
})

describe('generatePeriods', () => {
  it('generates 12 contiguous monthly periods for a calendar year', () => {
    const periods = generatePeriods(new Date(Date.UTC(2026, 0, 1)))

    expect(periods).toHaveLength(12)
    expect(periods[0].startDate.toISOString().slice(0, 10)).toBe('2026-01-01')
    expect(periods[0].endDate.toISOString().slice(0, 10)).toBe('2026-01-31')
    expect(periods[1].startDate.toISOString().slice(0, 10)).toBe('2026-02-01')
    expect(periods[11].endDate.toISOString().slice(0, 10)).toBe('2026-12-31')

    for (let index = 1; index < periods.length; index += 1) {
      const previousEnd = periods[index - 1].endDate.getTime()
      const nextStart = periods[index].startDate.getTime()

      expect(nextStart - previousEnd).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('handles leap-year February', () => {
    const periods = generatePeriods(new Date(Date.UTC(2028, 0, 1)))

    expect(periods[1].endDate.toISOString().slice(0, 10)).toBe('2028-02-29')
  })

  it('supports non-calendar fiscal years', () => {
    const periods = generatePeriods(new Date(Date.UTC(2026, 6, 1)))

    expect(periods[0].startDate.toISOString().slice(0, 10)).toBe('2026-07-01')
    expect(periods[11].endDate.toISOString().slice(0, 10)).toBe('2027-06-30')
  })

  it('appends the 13th adjustment period on request', () => {
    const periods = generatePeriods(new Date(Date.UTC(2026, 0, 1)), 12, {
      includeAdjustmentPeriod: true,
    })

    expect(periods).toHaveLength(13)
    expect(periods[12].isAdjustmentPeriod).toBe(true)
    expect(periods[12].startDate.toISOString().slice(0, 10)).toBe('2026-12-31')
    expect(periods[12].endDate.toISOString().slice(0, 10)).toBe('2026-12-31')
  })

  it('rejects invalid period counts', () => {
    expect(() => generatePeriods(new Date(), 0)).toThrow()
    expect(() => generatePeriods(new Date(), 13)).toThrow()
  })
})

describe('yearEndDate', () => {
  it('returns the latest period end', () => {
    const periods = generatePeriods(new Date(Date.UTC(2026, 0, 1)), 12, {
      includeAdjustmentPeriod: true,
    })

    expect(yearEndDate(periods).toISOString().slice(0, 10)).toBe('2026-12-31')
  })
})
