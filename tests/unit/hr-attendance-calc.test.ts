import { describe, expect, it } from 'vitest'
import { computeDaily, overtimePayHours } from '#/server/hr/attendance-calc'

const shift = {
  startTime: '09:00',
  endTime: '17:00',
  workHours: 8,
  graceInMins: 10,
  graceOutMins: 10,
}

describe('computeDaily', () => {
  it('marks a day with no punches absent', () => {
    const result = computeDaily([], shift)
    expect(result.attendanceCode).toBe('absent')
    expect(result.workedHours).toBe(0)
  })

  it('sums paired in/out intervals into worked hours', () => {
    const result = computeDaily(
      [
        { eventTime: new Date('2026-03-02T09:00:00Z'), direction: 'in' },
        { eventTime: new Date('2026-03-02T17:00:00Z'), direction: 'out' },
      ],
      shift,
    )
    expect(result.workedHours).toBe(8)
    expect(result.attendanceCode).toBe('present')
    expect(result.lateMinutes).toBe(0)
  })

  it('flags lateness beyond the grace window', () => {
    const result = computeDaily(
      [
        { eventTime: new Date('2026-03-02T09:25:00Z'), direction: 'in' },
        { eventTime: new Date('2026-03-02T17:00:00Z'), direction: 'out' },
      ],
      shift,
    )
    // 25 min late minus 10 min grace = 15
    expect(result.lateMinutes).toBe(15)
    expect(result.attendanceCode).toBe('late')
  })

  it('computes overtime beyond the shift target', () => {
    const result = computeDaily(
      [
        { eventTime: new Date('2026-03-02T09:00:00Z'), direction: 'in' },
        { eventTime: new Date('2026-03-02T19:00:00Z'), direction: 'out' },
      ],
      shift,
    )
    expect(result.workedHours).toBe(10)
    expect(result.overtimeHours).toBe(2)
  })

  it('handles multiple in/out pairs (split shift)', () => {
    const result = computeDaily([
      { eventTime: new Date('2026-03-02T09:00:00Z'), direction: 'in' },
      { eventTime: new Date('2026-03-02T12:00:00Z'), direction: 'out' },
      { eventTime: new Date('2026-03-02T13:00:00Z'), direction: 'in' },
      { eventTime: new Date('2026-03-02T18:00:00Z'), direction: 'out' },
    ])
    expect(result.workedHours).toBe(8)
  })
})

describe('overtimePayHours', () => {
  it('applies the rate multiplier', () => {
    expect(overtimePayHours(4, 1.5)).toBe(6)
  })
})
