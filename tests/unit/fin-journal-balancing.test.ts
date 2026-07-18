import { describe, expect, it } from 'vitest'
import { Prisma } from '#/server/db/generated/prisma/client'
import {
  assertBalanced,
  buildReversalLines,
  normalizeLines,
  sumBase,
  toBaseAmount,
  withRoundingLine,
} from '#/server/finance/journal-balancing'

const line = (input: {
  accountId?: string
  currencyCode?: string
  exchangeRate?: string | number
  debitAmount?: string | number
  creditAmount?: string | number
}) => ({
  accountId: input.accountId ?? 'acc-1',
  currencyCode: input.currencyCode ?? 'USD',
  exchangeRate: input.exchangeRate,
  debitAmount: input.debitAmount,
  creditAmount: input.creditAmount,
})

describe('toBaseAmount', () => {
  it('multiplies and rounds to 4 decimal places', () => {
    expect(toBaseAmount('100.1234', '1.23456789').toString()).toBe('123.6091')
  })

  it('is exact for rate 1', () => {
    expect(toBaseAmount('42.5', 1).toString()).toBe('42.5')
  })
})

describe('normalizeLines', () => {
  it('rejects entries with fewer than two lines', () => {
    expect(() => normalizeLines([line({ debitAmount: 10 })], 'USD')).toThrow(
      /at least two lines/,
    )
  })

  it('rejects a line that is both debit and credit', () => {
    expect(() =>
      normalizeLines(
        [
          line({ debitAmount: 10, creditAmount: 5 }),
          line({ creditAmount: 5 }),
        ],
        'USD',
      ),
    ).toThrow(/not both/)
  })

  it('rejects negative amounts', () => {
    expect(() =>
      normalizeLines(
        [line({ debitAmount: -10 }), line({ creditAmount: 10 })],
        'USD',
      ),
    ).toThrow(/non-negative/)
  })

  it('rejects zero lines', () => {
    expect(() =>
      normalizeLines([line({}), line({ creditAmount: 10 })], 'USD'),
    ).toThrow(/non-zero/)
  })

  it('forces rate 1 for base-currency lines', () => {
    const [first] = normalizeLines(
      [
        line({ debitAmount: 10, exchangeRate: 5 }),
        line({ creditAmount: 10 }),
      ],
      'USD',
    )

    expect(first.exchangeRate.toString()).toBe('1')
    expect(first.baseDebitAmount.toString()).toBe('10')
  })

  it('converts foreign-currency lines at their rate', () => {
    const lines = normalizeLines(
      [
        line({
          currencyCode: 'EUR',
          exchangeRate: '1.1',
          debitAmount: '100',
        }),
        line({ creditAmount: '110' }),
      ],
      'USD',
    )

    expect(lines[0].baseDebitAmount.toString()).toBe('110')
  })
})

describe('assertBalanced', () => {
  it('accepts a balanced entry and returns totals', () => {
    const lines = normalizeLines(
      [line({ debitAmount: 100 }), line({ creditAmount: 100 })],
      'USD',
    )

    const totals = assertBalanced(lines)

    expect(totals.totalBaseDebit.toString()).toBe('100')
    expect(totals.totalBaseCredit.toString()).toBe('100')
  })

  it('rejects an unbalanced entry', () => {
    const lines = normalizeLines(
      [line({ debitAmount: 100 }), line({ creditAmount: 90 })],
      'USD',
    )

    expect(() => assertBalanced(lines)).toThrow(/unbalanced/)
  })

  it('rejects a zero-total entry', () => {
    expect(() => assertBalanced([])).toThrow(/non-zero/)
  })
})

describe('withRoundingLine', () => {
  it('synthesizes a rounding line for a small FX residue', () => {
    const lines = normalizeLines(
      [
        line({ currencyCode: 'EUR', exchangeRate: '1.13333', debitAmount: '3' }),
        line({ creditAmount: '3.41' }),
      ],
      'USD',
    )

    const withRounding = withRoundingLine(lines, 'rounding-acc', 'USD')

    expect(withRounding).toHaveLength(3)
    expect(withRounding[2].accountId).toBe('rounding-acc')
    expect(() => assertBalanced(withRounding)).not.toThrow()
  })

  it('leaves large residues alone so assertBalanced rejects them', () => {
    const lines = normalizeLines(
      [line({ debitAmount: '100' }), line({ creditAmount: '90' })],
      'USD',
    )

    const unchanged = withRoundingLine(lines, 'rounding-acc', 'USD')

    expect(unchanged).toHaveLength(2)
    expect(() => assertBalanced(unchanged)).toThrow(/unbalanced/)
  })

  it('does nothing when already balanced', () => {
    const lines = normalizeLines(
      [line({ debitAmount: '10' }), line({ creditAmount: '10' })],
      'USD',
    )

    expect(withRoundingLine(lines, 'rounding-acc', 'USD')).toHaveLength(2)
  })
})

describe('buildReversalLines', () => {
  it('mirrors debits and credits', () => {
    const original = normalizeLines(
      [line({ debitAmount: '75.5' }), line({ creditAmount: '75.5' })],
      'USD',
    )

    const reversal = buildReversalLines(original)

    expect(reversal[0].creditAmount.toString()).toBe('75.5')
    expect(reversal[0].debitAmount.toString()).toBe('0')
    expect(reversal[1].debitAmount.toString()).toBe('75.5')

    const totals = sumBase(reversal)
    expect(totals.totalBaseDebit.equals(totals.totalBaseCredit)).toBe(true)
  })

  it('preserves currency and dimensions', () => {
    const original = normalizeLines(
      [
        {
          ...line({
            currencyCode: 'EUR',
            exchangeRate: '2',
            debitAmount: '10',
          }),
          costCenterId: 'cc-1',
        },
        line({ creditAmount: '20' }),
      ],
      'USD',
    )

    const reversal = buildReversalLines(original)

    expect(reversal[0].currencyCode).toBe('EUR')
    expect(reversal[0].exchangeRate.equals(new Prisma.Decimal(2))).toBe(true)
    expect(reversal[0].costCenterId).toBe('cc-1')
  })
})
