import { describe, expect, it } from 'vitest'
import {
  accountCreateSchema,
  bootstrapSchema,
  exchangeRateUpsertSchema,
  journalEntryCreateSchema,
  postingRuleUpsertSchema,
} from '#/features/finance/finance-validation'

const uuid = '5b0f6a1a-1234-4c56-8def-1234567890ab'

describe('journalEntryCreateSchema', () => {
  const validLine = (side: 'debit' | 'credit') => ({
    accountId: uuid,
    currencyCode: 'USD',
    ...(side === 'debit' ? { debitAmount: '100.50' } : { creditAmount: 100.5 }),
  })

  it('accepts a minimal balanced entry with mixed decimal input styles', () => {
    const parsed = journalEntryCreateSchema.parse({
      entryDate: '2026-07-01',
      lines: [validLine('debit'), validLine('credit')],
    })

    expect(parsed.entryDate).toBeInstanceOf(Date)
    expect(parsed.lines).toHaveLength(2)
  })

  it('rejects fewer than two lines', () => {
    expect(() =>
      journalEntryCreateSchema.parse({
        entryDate: '2026-07-01',
        lines: [validLine('debit')],
      }),
    ).toThrow()
  })

  it('rejects malformed decimal strings', () => {
    expect(() =>
      journalEntryCreateSchema.parse({
        entryDate: '2026-07-01',
        lines: [
          { accountId: uuid, currencyCode: 'USD', debitAmount: '10.5.5' },
          validLine('credit'),
        ],
      }),
    ).toThrow()
  })

  it('rejects invalid currency codes', () => {
    expect(() =>
      journalEntryCreateSchema.parse({
        entryDate: '2026-07-01',
        lines: [
          { accountId: uuid, currencyCode: 'USDX', debitAmount: 10 },
          validLine('credit'),
        ],
      }),
    ).toThrow()
  })
})

describe('accountCreateSchema', () => {
  it('accepts a typical account', () => {
    const parsed = accountCreateSchema.parse({
      code: '1111',
      name: 'Petty Cash',
      nameAr: 'نثريات',
      accountTypeCode: 'cash',
    })

    expect(parsed.code).toBe('1111')
  })

  it('rejects an empty code', () => {
    expect(() =>
      accountCreateSchema.parse({
        code: '',
        name: 'X',
        accountTypeCode: 'cash',
      }),
    ).toThrow()
  })
})

describe('bootstrapSchema', () => {
  it('coerces the fiscal year start date', () => {
    const parsed = bootstrapSchema.parse({ fiscalYearStart: '2026-01-01' })

    expect(parsed.fiscalYearStart).toBeInstanceOf(Date)
  })
})

describe('exchangeRateUpsertSchema', () => {
  it('accepts spot rates', () => {
    const parsed = exchangeRateUpsertSchema.parse({
      fromCurrencyCode: 'EUR',
      toCurrencyCode: 'USD',
      rateDate: '2026-07-01',
      rate: '1.08551234',
    })

    expect(parsed.rateType).toBeUndefined()
  })

  it('rejects unknown rate types', () => {
    expect(() =>
      exchangeRateUpsertSchema.parse({
        fromCurrencyCode: 'EUR',
        toCurrencyCode: 'USD',
        rateDate: '2026-07-01',
        rate: 1.1,
        rateType: 'random',
      }),
    ).toThrow()
  })
})

describe('postingRuleUpsertSchema', () => {
  it('requires at least a debit and a credit line', () => {
    expect(() =>
      postingRuleUpsertSchema.parse({
        eventType: 'pos_sale.completed',
        lines: [
          {
            lineNumber: 10,
            lineRole: 'settlement',
            side: 'debit',
            accountSource: 'mapping',
            mappingRole: 'settlement',
            amountSelector: 'paid_total',
          },
        ],
      }),
    ).toThrow()
  })

  it('accepts a complete rule', () => {
    const parsed = postingRuleUpsertSchema.parse({
      eventType: 'pos_sale.completed',
      journalTypeCode: 'sales',
      lines: [
        {
          lineNumber: 10,
          lineRole: 'settlement',
          side: 'debit',
          accountSource: 'mapping',
          mappingEntityType: 'payment_method',
          mappingRole: 'settlement',
          amountSelector: 'paid_total',
        },
        {
          lineNumber: 20,
          lineRole: 'sales_revenue',
          side: 'credit',
          accountSource: 'settings_default',
          settingsField: 'salesRevenueAccountId',
          amountSelector: 'net_total',
        },
      ],
    })

    expect(parsed.lines).toHaveLength(2)
  })
})
