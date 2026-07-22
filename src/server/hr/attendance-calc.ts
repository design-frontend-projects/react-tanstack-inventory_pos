// Pure attendance-calculation helpers — no I/O — so they are unit-testable.
// Raw in/out punches for one employee-day are reduced to worked hours, lateness,
// early-out, and overtime against an optional shift definition.

export interface PunchLog {
  eventTime: Date
  direction: string // 'in' | 'out'
}

export interface ShiftSpec {
  startTime?: string | null // 'HH:MM'
  endTime?: string | null
  workHours?: number | null
  graceInMins?: number | null
  graceOutMins?: number | null
}

export interface DailyCalc {
  firstIn: Date | null
  lastOut: Date | null
  workedHours: number
  lateMinutes: number
  earlyOutMins: number
  overtimeHours: number
  attendanceCode: string
}

const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_MIN = 60 * 1000

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// Parses 'HH:MM' into minutes-since-midnight, or null.
function parseHm(value: string | null | undefined): number | null {
  if (!value) return null
  const [h, m] = value.split(':').map((part) => Number(part))
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

// Reduces punches to a daily summary. Worked hours are the sum of paired
// in→out intervals (unpaired trailing 'in' is ignored). Lateness/early-out are
// measured against the shift window plus its grace allowances.
export function computeDaily(
  logs: ReadonlyArray<PunchLog>,
  shift?: ShiftSpec | null,
): DailyCalc {
  if (logs.length === 0) {
    return {
      firstIn: null,
      lastOut: null,
      workedHours: 0,
      lateMinutes: 0,
      earlyOutMins: 0,
      overtimeHours: 0,
      attendanceCode: 'absent',
    }
  }

  const sorted = [...logs].sort(
    (a, b) => a.eventTime.getTime() - b.eventTime.getTime(),
  )

  const ins = sorted.filter((l) => l.direction === 'in')
  const outs = sorted.filter((l) => l.direction === 'out')
  const firstIn = ins.length > 0 ? ins[0].eventTime : sorted[0].eventTime
  const lastOut = outs.length > 0 ? outs[outs.length - 1].eventTime : null

  // Sum paired intervals in chronological order.
  let workedMs = 0
  let openIn: Date | null = null
  for (const log of sorted) {
    if (log.direction === 'in') {
      openIn = log.eventTime
    } else if (log.direction === 'out' && openIn) {
      workedMs += log.eventTime.getTime() - openIn.getTime()
      openIn = null
    }
  }
  const workedHours = round2(workedMs / MS_PER_HOUR)

  let lateMinutes = 0
  let earlyOutMins = 0
  let overtimeHours = 0

  const shiftStart = parseHm(shift?.startTime)
  const shiftEnd = parseHm(shift?.endTime)
  const grace = shift?.graceInMins ?? 0
  const graceOut = shift?.graceOutMins ?? 0

  if (shiftStart !== null) {
    const lateBy = minutesOfDay(firstIn) - (shiftStart + grace)
    lateMinutes = lateBy > 0 ? lateBy : 0
  }
  if (shiftEnd !== null && lastOut) {
    const earlyBy = shiftEnd - graceOut - minutesOfDay(lastOut)
    earlyOutMins = earlyBy > 0 ? earlyBy : 0
  }

  const targetHours = shift?.workHours ?? null
  if (targetHours && workedHours > targetHours) {
    overtimeHours = round2(workedHours - targetHours)
  }

  let attendanceCode = 'present'
  if (lateMinutes > 0) attendanceCode = 'late'

  return {
    firstIn,
    lastOut,
    workedHours,
    lateMinutes,
    earlyOutMins,
    overtimeHours,
    attendanceCode,
  }
}

// Overtime pay hours after applying a rate multiplier (e.g. 1.5x).
export function overtimePayHours(hours: number, multiplier: number): number {
  return round2(hours * multiplier)
}
