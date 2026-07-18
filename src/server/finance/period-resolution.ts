import { ConflictError } from '#/server/auth/errors'

// Pure fiscal-period gate: a posting is only allowed into an OPEN period whose
// module (if any) is not soft-locked. Adjustment periods additionally require
// an explicit opt-in from the caller.

export interface ResolvablePeriod {
  id: string
  statusCode: string
  isAdjustmentPeriod: boolean
  startDate: Date
  endDate: Date
  moduleLocks?: Array<{ moduleCode: string }>
}

export interface PeriodGateOptions {
  moduleCode?: string
  allowAdjustmentPeriod?: boolean
}

export function assertPeriodOpenForPosting(
  period: ResolvablePeriod | null,
  entryDate: Date,
  options: PeriodGateOptions = {},
): ResolvablePeriod {
  if (!period) {
    throw new ConflictError(
      `No fiscal period covers ${entryDate.toISOString().slice(0, 10)}. Create the fiscal year first.`,
    )
  }

  if (period.statusCode !== 'open') {
    throw new ConflictError(
      `Fiscal period is ${period.statusCode} — postings are rejected.`,
    )
  }

  if (period.isAdjustmentPeriod && !options.allowAdjustmentPeriod) {
    throw new ConflictError(
      'Adjustment periods only accept explicitly flagged adjustment postings.',
    )
  }

  if (
    options.moduleCode &&
    period.moduleLocks?.some((lock) => lock.moduleCode === options.moduleCode)
  ) {
    throw new ConflictError(
      `Fiscal period is locked for module "${options.moduleCode}".`,
    )
  }

  return period
}

// Pure generator for a fiscal year's monthly periods (+ optional 13th
// adjustment period sharing the year-end date).
export interface GeneratedPeriod {
  periodNumber: number
  name: string
  startDate: Date
  endDate: Date
  isAdjustmentPeriod: boolean
}

export function generatePeriods(
  startDate: Date,
  periodCount = 12,
  options: { includeAdjustmentPeriod?: boolean } = {},
): Array<GeneratedPeriod> {
  if (periodCount < 1 || periodCount > 12) {
    throw new ConflictError('A fiscal year needs between 1 and 12 periods.')
  }

  const periods: Array<GeneratedPeriod> = []

  for (let index = 0; index < periodCount; index += 1) {
    const start = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + index,
        startDate.getUTCDate(),
      ),
    )
    // End = day before the next period's start (handles month lengths + leap
    // years via Date's own calendar arithmetic).
    const end = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + index + 1,
        startDate.getUTCDate(),
      ),
    )
    end.setUTCDate(end.getUTCDate() - 1)

    periods.push({
      periodNumber: index + 1,
      name: `P${String(index + 1).padStart(2, '0')} ${start.toISOString().slice(0, 7)}`,
      startDate: start,
      endDate: end,
      isAdjustmentPeriod: false,
    })
  }

  if (options.includeAdjustmentPeriod) {
    const lastPeriod = periods[periods.length - 1]
    periods.push({
      periodNumber: periodCount + 1,
      name: `P${String(periodCount + 1).padStart(2, '0')} Adjustments`,
      startDate: lastPeriod.endDate,
      endDate: lastPeriod.endDate,
      isAdjustmentPeriod: true,
    })
  }

  return periods
}

export function yearEndDate(periods: Array<GeneratedPeriod>): Date {
  return periods.reduce(
    (latest, period) => (period.endDate > latest ? period.endDate : latest),
    periods[0].endDate,
  )
}
