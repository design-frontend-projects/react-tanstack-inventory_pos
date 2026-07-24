import { describe, expect, it } from 'vitest'
import {
  formatJournalStatus,
  formatMoney,
  formatPeriodStatus,
  naturalBalance,
  signedBalance,
  summarizeTrialBalance,
  toNumber,
} from '#/features/finance/finance-format'

describe('toNumber', () => {
  it('parses decimal strings from the DTO layer', () => {
    expect(toNumber('1234.56')).toBe(1234.56)
    expect(toNumber('-42')).toBe(-42)
  })

  it('treats null, undefined, and garbage as zero', () => {
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber('not-a-number')).toBe(0)
  })
})

describe('balance math', () => {
  it('signed balance is debit minus credit', () => {
    expect(signedBalance('100', '30')).toBe(70)
    expect(signedBalance(0, '50')).toBe(-50)
  })

  it('debit-normal classes read positive when in debit', () => {
    expect(naturalBalance('asset', '100', '30')).toBe(70)
    expect(naturalBalance('expense', '100', '0')).toBe(100)
  })

  it('credit-normal classes read positive when in credit', () => {
    expect(naturalBalance('liability', '30', '100')).toBe(70)
    expect(naturalBalance('equity', '0', '500')).toBe(500)
    expect(naturalBalance('revenue', '0', '800')).toBe(800)
  })
})

describe('formatMoney', () => {
  it('formats a known ISO currency', () => {
    expect(formatMoney(1234.5, 'USD')).toContain('1,234.5')
  })

  it('falls back to a grouped number for unknown codes', () => {
    expect(formatMoney(1000, 'XXX_BAD')).toContain('XXX_BAD')
  })
})

describe('status labels', () => {
  it('labels journal statuses', () => {
    expect(formatJournalStatus('draft')).toBe('Draft')
    expect(formatJournalStatus('posted')).toBe('Posted')
    expect(formatJournalStatus('reversed')).toBe('Reversed')
    expect(formatJournalStatus(null)).toBe('Unknown')
  })

  it('labels period statuses', () => {
    expect(formatPeriodStatus('open')).toBe('Open')
    expect(formatPeriodStatus('locked')).toBe('Locked')
    expect(formatPeriodStatus('future')).toBe('Future')
  })
})

describe('summarizeTrialBalance', () => {
  const rows = [
    // Assets: cash 500, bank 1500, AR 700
    { classCode: 'asset', typeCode: 'cash', debit: '500', credit: '0' },
    { classCode: 'asset', typeCode: 'bank', debit: '1500', credit: '0' },
    {
      classCode: 'asset',
      typeCode: 'ar_control',
      controlDomain: 'ar',
      debit: '700',
      credit: '0',
    },
    // Liabilities: AP 900
    {
      classCode: 'liability',
      typeCode: 'ap_control',
      controlDomain: 'ap',
      debit: '0',
      credit: '900',
    },
    // Equity 1000
    { classCode: 'equity', typeCode: 'capital', debit: '0', credit: '1000' },
    // Revenue 2000, expenses 1200
    {
      classCode: 'revenue',
      typeCode: 'sales_revenue',
      debit: '0',
      credit: '2000',
    },
    {
      classCode: 'expense',
      typeCode: 'operating_expense',
      debit: '1200',
      credit: '0',
    },
  ]

  it('rolls classified rows into headline figures', () => {
    const summary = summarizeTrialBalance(rows)

    expect(summary.totalAssets).toBe(2700)
    expect(summary.totalLiabilities).toBe(900)
    expect(summary.totalEquity).toBe(1000)
    expect(summary.revenue).toBe(2000)
    expect(summary.expenses).toBe(1200)
    expect(summary.netProfit).toBe(800)
    expect(summary.cash).toBe(500)
    expect(summary.bank).toBe(1500)
    expect(summary.accountsReceivable).toBe(700)
    expect(summary.accountsPayable).toBe(900)
  })

  it('keeps the double-entry identity: debits equal credits', () => {
    const summary = summarizeTrialBalance(rows)

    expect(summary.totalDebit).toBe(3900)
    expect(summary.totalCredit).toBe(3900)
    expect(summary.difference).toBe(0)
  })

  it('returns zeros for an empty ledger', () => {
    const summary = summarizeTrialBalance([])

    expect(summary.totalAssets).toBe(0)
    expect(summary.netProfit).toBe(0)
    expect(summary.difference).toBe(0)
  })
})
