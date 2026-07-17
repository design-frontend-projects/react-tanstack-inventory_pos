import { ConflictError } from '#/server/auth/errors'
import { Prisma } from '#/server/db/generated/prisma/client'

// Pure landed-cost allocation math (unit-testable, no database). A voucher's
// total charges are distributed across receipt lines proportionally to a basis
// (quantity, value, weight, or caller-provided manual values). Unlike the DB
// helper `pod_allocate_landed_cost` (per-row ROUND), this core assigns the
// rounding remainder to the largest share so the rows always sum EXACTLY to the
// charge total — cents never leak.

export type AllocationBasis =
  | 'quantity'
  | 'value'
  | 'weight'
  | 'volume'
  | 'manual'

export interface AllocationTargetInput {
  key: string
  /** Accepted quantity on the receipt line. */
  quantity: Prisma.Decimal | string | number
  /** PO/receipt unit cost — used for the `value` basis. */
  unitCost: Prisma.Decimal | string | number
  /** Per-unit weight — used for the `weight` basis. */
  weightPerUnit?: Prisma.Decimal | string | number | null
  /** Explicit basis value — required for `manual` (and `volume`). */
  manualBasisValue?: Prisma.Decimal | string | number | null
}

export interface AllocationRow {
  key: string
  basisValue: Prisma.Decimal
  allocatedAmount: Prisma.Decimal
}

const ZERO = new Prisma.Decimal(0)

export function deriveBasisValue(
  basis: AllocationBasis,
  target: AllocationTargetInput,
): Prisma.Decimal {
  const quantity = new Prisma.Decimal(target.quantity)

  switch (basis) {
    case 'quantity':
      return quantity
    case 'value':
      return quantity.times(new Prisma.Decimal(target.unitCost))
    case 'weight':
      return quantity.times(new Prisma.Decimal(target.weightPerUnit ?? 0))
    case 'volume':
    case 'manual': {
      if (
        target.manualBasisValue === null ||
        target.manualBasisValue === undefined
      ) {
        throw new ConflictError(
          `The "${basis}" allocation basis requires an explicit basis value per line.`,
        )
      }

      return new Prisma.Decimal(target.manualBasisValue)
    }
  }
}

// Proportional distribution with exact-sum rounding: each row gets
// round(total * share, dp); the residual (± a few smallest units) lands on the
// row with the largest basis so SUM(allocated) === total.
export function allocateProRata(
  total: Prisma.Decimal | string | number,
  targets: Array<{ key: string; basisValue: Prisma.Decimal }>,
  decimalPlaces = 4,
): Array<AllocationRow> {
  const totalCharges = new Prisma.Decimal(total)
  const basisSum = targets.reduce(
    (sum, target) => sum.plus(target.basisValue),
    ZERO,
  )

  if (targets.length === 0 || basisSum.lte(ZERO)) {
    throw new ConflictError(
      'Allocation basis values must sum to a positive amount.',
    )
  }

  const rows = targets.map((target) => ({
    key: target.key,
    basisValue: target.basisValue,
    allocatedAmount: totalCharges
      .times(target.basisValue)
      .dividedBy(basisSum)
      .toDecimalPlaces(decimalPlaces),
  }))

  const allocatedSum = rows.reduce(
    (sum, row) => sum.plus(row.allocatedAmount),
    ZERO,
  )
  const residual = totalCharges.minus(allocatedSum)

  if (!residual.isZero()) {
    const largest = rows.reduce((max, row) =>
      row.basisValue.greaterThan(max.basisValue) ? row : max,
    )

    return rows.map((row) =>
      row.key === largest.key
        ? { ...row, allocatedAmount: row.allocatedAmount.plus(residual) }
        : row,
    )
  }

  return rows
}

export function allocateLandedCost(
  basis: AllocationBasis,
  total: Prisma.Decimal | string | number,
  targets: Array<AllocationTargetInput>,
): Array<AllocationRow> {
  return allocateProRata(
    total,
    targets.map((target) => ({
      key: target.key,
      basisValue: deriveBasisValue(basis, target),
    })),
  )
}
