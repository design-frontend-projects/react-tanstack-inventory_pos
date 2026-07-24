// Pure finance formatting + classification helpers. No React, no Prisma — unit
// tested in tests/unit/finance-format.test.ts and reused across every finance
// workspace so numbers, dates, and account math read identically everywhere.

export type AccountClassCode =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'

// Debit-normal classes carry a positive natural balance on the debit side.
const DEBIT_NORMAL_CLASSES: ReadonlySet<string> = new Set(['asset', 'expense'])

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

// Signed movement in base currency: debit minus credit.
export function signedBalance(
  debit: string | number,
  credit: string | number,
): number {
  return toNumber(debit) - toNumber(credit)
}

// Natural balance for the account's normal side, so a credit-normal account
// (liability/equity/revenue) reads as a positive figure when in credit.
export function naturalBalance(
  classCode: string,
  debit: string | number,
  credit: string | number,
): number {
  const delta = signedBalance(debit, credit)
  return DEBIT_NORMAL_CLASSES.has(classCode) ? delta : -delta
}

export function formatMoney(
  value: string | number | null | undefined,
  currency = 'USD',
  locale = 'en',
): string {
  const numeric = toNumber(value)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(numeric)
  } catch {
    // Unknown ISO code — fall back to a plain grouped number with the code.
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(numeric)} ${currency}`
  }
}

export function formatNumber(
  value: string | number | null | undefined,
  locale = 'en',
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    toNumber(value),
  )
}

export function formatDate(
  value: string | Date | null | undefined,
  locale = 'en',
): string {
  if (!value) {
    return '—'
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

// --- Journal + period status presentation ----------------------------------

const JOURNAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  reversed: 'Reversed',
}

export function formatJournalStatus(status: string | null | undefined): string {
  if (!status) {
    return 'Unknown'
  }
  return (
    JOURNAL_STATUS_LABELS[status.toLowerCase()] ??
    status.charAt(0).toUpperCase() + status.slice(1)
  )
}

const PERIOD_STATUS_LABELS: Record<string, string> = {
  future: 'Future',
  open: 'Open',
  closed: 'Closed',
  locked: 'Locked',
}

export function formatPeriodStatus(status: string | null | undefined): string {
  if (!status) {
    return 'Unknown'
  }
  return (
    PERIOD_STATUS_LABELS[status.toLowerCase()] ??
    status.charAt(0).toUpperCase() + status.slice(1)
  )
}

// --- Trial-balance aggregation for the CFO dashboard + reports --------------

export interface ClassifiedBalanceRow {
  classCode: string
  typeCode: string
  controlDomain?: string | null
  debit: string | number
  credit: string | number
}

export interface FinancialSummary {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  revenue: number
  expenses: number
  netProfit: number
  cash: number
  bank: number
  accountsReceivable: number
  accountsPayable: number
  totalDebit: number
  totalCredit: number
  difference: number
}

// Roll a classified trial balance into the headline financial figures. Every
// value is expressed as a natural (positive-when-normal) magnitude.
export function summarizeTrialBalance(
  rows: ReadonlyArray<ClassifiedBalanceRow>,
): FinancialSummary {
  const summary: FinancialSummary = {
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    cash: 0,
    bank: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    totalDebit: 0,
    totalCredit: 0,
    difference: 0,
  }

  for (const row of rows) {
    const natural = naturalBalance(row.classCode, row.debit, row.credit)
    summary.totalDebit += toNumber(row.debit)
    summary.totalCredit += toNumber(row.credit)

    switch (row.classCode) {
      case 'asset':
        summary.totalAssets += natural
        if (row.typeCode === 'cash') {
          summary.cash += natural
        }
        if (row.typeCode === 'bank') {
          summary.bank += natural
        }
        if (row.controlDomain === 'ar' || row.typeCode === 'ar_control') {
          summary.accountsReceivable += natural
        }
        break
      case 'liability':
        summary.totalLiabilities += natural
        if (row.controlDomain === 'ap' || row.typeCode === 'ap_control') {
          summary.accountsPayable += natural
        }
        break
      case 'equity':
        summary.totalEquity += natural
        break
      case 'revenue':
        summary.revenue += natural
        break
      case 'expense':
        summary.expenses += natural
        break
      default:
        break
    }
  }

  summary.netProfit = summary.revenue - summary.expenses
  summary.difference = summary.totalDebit - summary.totalCredit
  return summary
}
