import { Prisma } from '#/server/db/generated/prisma/client'
import { ConflictError, ValidationError } from '#/server/auth/errors'

// Pure double-entry math: line normalization, base-currency conversion,
// rounding-line synthesis, and the balanced-entry assertion. No Prisma I/O —
// everything here is unit-testable with plain values.

const ZERO = new Prisma.Decimal(0)

// Largest base-currency residue we will absorb into the rounding account.
// Anything larger than this is a caller bug, not FX rounding.
export const MAX_ROUNDING_RESIDUE = new Prisma.Decimal('0.05')

export interface JournalLineInput {
  lineNumber?: number
  accountId: string
  description?: string | null
  currencyCode: string
  exchangeRate?: Prisma.Decimal | string | number | null
  debitAmount?: Prisma.Decimal | string | number | null
  creditAmount?: Prisma.Decimal | string | number | null
  partyType?: string | null
  partyId?: string | null
  costCenterId?: string | null
  projectId?: string | null
  branchId?: string | null
  warehouseId?: string | null
  taxCodeId?: string | null
  sourceLineId?: string | null
}

export interface NormalizedJournalLine {
  lineNumber: number
  accountId: string
  description: string | null
  currencyCode: string
  exchangeRate: Prisma.Decimal
  debitAmount: Prisma.Decimal
  creditAmount: Prisma.Decimal
  baseDebitAmount: Prisma.Decimal
  baseCreditAmount: Prisma.Decimal
  partyType: string | null
  partyId: string | null
  costCenterId: string | null
  projectId: string | null
  branchId: string | null
  warehouseId: string | null
  taxCodeId: string | null
  sourceLineId: string | null
}

// Base amounts are rounded to 4dp — the (19,4) storage scale and the
// balancing authority for the whole engine.
export function toBaseAmount(
  amount: Prisma.Decimal | string | number,
  exchangeRate: Prisma.Decimal | string | number,
): Prisma.Decimal {
  return new Prisma.Decimal(amount)
    .times(new Prisma.Decimal(exchangeRate))
    .toDecimalPlaces(4)
}

// Validates each raw line (single-sided, non-negative, positive) and computes
// base amounts from the line's exchange rate. Line numbers are (re)assigned
// sequentially when absent.
export function normalizeLines(
  lines: Array<JournalLineInput>,
  baseCurrencyCode: string,
): Array<NormalizedJournalLine> {
  if (lines.length < 2) {
    throw new ValidationError('A journal entry requires at least two lines.')
  }

  return lines.map((line, index) => {
    const debit = new Prisma.Decimal(line.debitAmount ?? 0)
    const credit = new Prisma.Decimal(line.creditAmount ?? 0)

    if (debit.isNegative() || credit.isNegative()) {
      throw new ValidationError(
        `Line ${index + 1}: debit and credit must be non-negative.`,
      )
    }

    if (debit.greaterThan(ZERO) && credit.greaterThan(ZERO)) {
      throw new ValidationError(
        `Line ${index + 1}: a line must be debit or credit, not both.`,
      )
    }

    if (debit.equals(ZERO) && credit.equals(ZERO)) {
      throw new ValidationError(
        `Line ${index + 1}: a line must carry a non-zero amount.`,
      )
    }

    const isBaseCurrency = line.currencyCode === baseCurrencyCode
    const exchangeRate = isBaseCurrency
      ? new Prisma.Decimal(1)
      : new Prisma.Decimal(line.exchangeRate ?? 1)

    if (exchangeRate.lessThanOrEqualTo(ZERO)) {
      throw new ValidationError(
        `Line ${index + 1}: exchange rate must be positive.`,
      )
    }

    return {
      lineNumber: line.lineNumber ?? index + 1,
      accountId: line.accountId,
      description: line.description ?? null,
      currencyCode: line.currencyCode,
      exchangeRate,
      debitAmount: debit,
      creditAmount: credit,
      baseDebitAmount: toBaseAmount(debit, exchangeRate),
      baseCreditAmount: toBaseAmount(credit, exchangeRate),
      partyType: line.partyType ?? null,
      partyId: line.partyId ?? null,
      costCenterId: line.costCenterId ?? null,
      projectId: line.projectId ?? null,
      branchId: line.branchId ?? null,
      warehouseId: line.warehouseId ?? null,
      taxCodeId: line.taxCodeId ?? null,
      sourceLineId: line.sourceLineId ?? null,
    }
  })
}

export function sumBase(lines: Array<NormalizedJournalLine>): {
  totalBaseDebit: Prisma.Decimal
  totalBaseCredit: Prisma.Decimal
} {
  return {
    totalBaseDebit: lines.reduce(
      (sum, line) => sum.plus(line.baseDebitAmount),
      ZERO,
    ),
    totalBaseCredit: lines.reduce(
      (sum, line) => sum.plus(line.baseCreditAmount),
      ZERO,
    ),
  }
}

// If mixed-currency conversion leaves a tiny base residue (|residue| <=
// MAX_ROUNDING_RESIDUE), synthesize a balancing line against the rounding
// account. Larger residues are rejected — that is a data problem.
export function withRoundingLine(
  lines: Array<NormalizedJournalLine>,
  roundingAccountId: string | null,
  baseCurrencyCode: string,
): Array<NormalizedJournalLine> {
  const { totalBaseDebit, totalBaseCredit } = sumBase(lines)
  const residue = totalBaseDebit.minus(totalBaseCredit)

  if (residue.equals(ZERO)) {
    return lines
  }

  if (residue.abs().greaterThan(MAX_ROUNDING_RESIDUE)) {
    return lines
  }

  if (!roundingAccountId) {
    return lines
  }

  const roundingLine: NormalizedJournalLine = {
    lineNumber: lines.length + 1,
    accountId: roundingAccountId,
    description: 'FX rounding residue',
    currencyCode: baseCurrencyCode,
    exchangeRate: new Prisma.Decimal(1),
    debitAmount: residue.isNegative() ? residue.abs() : ZERO,
    creditAmount: residue.isNegative() ? ZERO : residue,
    baseDebitAmount: residue.isNegative() ? residue.abs() : ZERO,
    baseCreditAmount: residue.isNegative() ? ZERO : residue,
    partyType: null,
    partyId: null,
    costCenterId: null,
    projectId: null,
    branchId: null,
    warehouseId: null,
    taxCodeId: null,
    sourceLineId: null,
  }

  return [...lines, roundingLine]
}

// The double-entry invariant. Base amounts are authoritative.
export function assertBalanced(lines: Array<NormalizedJournalLine>): {
  totalBaseDebit: Prisma.Decimal
  totalBaseCredit: Prisma.Decimal
} {
  const totals = sumBase(lines)

  if (!totals.totalBaseDebit.equals(totals.totalBaseCredit)) {
    throw new ConflictError(
      `Journal entry is unbalanced: base debit ${totals.totalBaseDebit.toString()} != base credit ${totals.totalBaseCredit.toString()}.`,
    )
  }

  if (totals.totalBaseDebit.equals(ZERO)) {
    throw new ConflictError('Journal entry total must be non-zero.')
  }

  return totals
}

// Mirror-image lines for a reversal entry.
export function buildReversalLines(
  lines: Array<{
    lineNumber: number
    accountId: string
    description: string | null
    currencyCode: string
    exchangeRate: Prisma.Decimal
    debitAmount: Prisma.Decimal
    creditAmount: Prisma.Decimal
    baseDebitAmount: Prisma.Decimal
    baseCreditAmount: Prisma.Decimal
    partyType: string | null
    partyId: string | null
    costCenterId: string | null
    projectId: string | null
    branchId: string | null
    warehouseId: string | null
    taxCodeId: string | null
  }>,
): Array<NormalizedJournalLine> {
  return lines.map((line) => ({
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    description: line.description,
    currencyCode: line.currencyCode,
    exchangeRate: line.exchangeRate,
    debitAmount: line.creditAmount,
    creditAmount: line.debitAmount,
    baseDebitAmount: line.baseCreditAmount,
    baseCreditAmount: line.baseDebitAmount,
    partyType: line.partyType,
    partyId: line.partyId,
    costCenterId: line.costCenterId,
    projectId: line.projectId,
    branchId: line.branchId,
    warehouseId: line.warehouseId,
    taxCodeId: line.taxCodeId,
    sourceLineId: null,
  }))
}
