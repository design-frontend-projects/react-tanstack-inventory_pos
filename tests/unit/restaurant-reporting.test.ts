import { describe, expect, it } from 'vitest'
import {
  averageTicket,
  buildHeatmapGrid,
  fillDailySeries,
  fillHourlySeries,
} from '#/server/restaurant/reporting/reporting-utils'

describe('fillHourlySeries', () => {
  it('fills all 24 hours with zeros for missing buckets', () => {
    const series = fillHourlySeries([
      { hour: 12, sales: '150.00', orders: 3 },
      { hour: 19, sales: '420.00', orders: 8 },
    ])

    expect(series).toHaveLength(24)
    expect(series[12]).toEqual({ hour: 12, sales: '150.00', orders: 3 })
    expect(series[19]).toEqual({ hour: 19, sales: '420.00', orders: 8 })
    expect(series[0]).toEqual({ hour: 0, sales: '0', orders: 0 })
    expect(series[23]).toEqual({ hour: 23, sales: '0', orders: 0 })
  })

  it('respects a custom hour window', () => {
    const series = fillHourlySeries([], 8, 11)
    expect(series.map((point) => point.hour)).toEqual([8, 9, 10, 11])
  })
})

describe('fillDailySeries', () => {
  it('fills every calendar day between from and to inclusive', () => {
    const series = fillDailySeries(
      [{ date: '2026-07-16', sales: '99.00', orders: 2 }],
      '2026-07-15T00:00:00.000Z',
      '2026-07-18T00:00:00.000Z',
    )

    expect(series.map((point) => point.date)).toEqual([
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
    ])
    expect(series[1].sales).toBe('99.00')
    expect(series[0].sales).toBe('0')
  })

  it('crosses month boundaries correctly', () => {
    const series = fillDailySeries(
      [],
      '2026-06-29T00:00:00.000Z',
      '2026-07-02T00:00:00.000Z',
    )
    expect(series.map((point) => point.date)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ])
  })
})

describe('buildHeatmapGrid', () => {
  it('produces a full 7x24 grid', () => {
    const grid = buildHeatmapGrid([])
    expect(grid).toHaveLength(7 * 24)
  })

  it('re-indexes Postgres DOW (0=Sunday) to Monday-first', () => {
    // Postgres DOW 1 = Monday → our index 0; DOW 0 = Sunday → our index 6.
    const grid = buildHeatmapGrid([
      { dow: 1, hour: 9, sales: '10', orders: 1 },
      { dow: 0, hour: 20, sales: '55', orders: 2 },
    ])

    const monday = grid.find((cell) => cell.dayOfWeek === 0 && cell.hour === 9)
    const sunday = grid.find((cell) => cell.dayOfWeek === 6 && cell.hour === 20)
    expect(monday?.sales).toBe('10')
    expect(sunday?.sales).toBe('55')
  })
})

describe('averageTicket', () => {
  it('divides sales by order count', () => {
    expect(averageTicket('300', 4)).toBe('75.00')
  })

  it('returns 0 for zero orders', () => {
    expect(averageTicket('300', 0)).toBe('0')
  })
})
