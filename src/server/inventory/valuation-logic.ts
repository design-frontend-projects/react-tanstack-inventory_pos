import { Prisma } from '#/server/db/generated/prisma/client'

// Pure valuation aggregation. Given per-grain balance rows, roll up total on-hand
// and total value, and derive the blended weighted-average unit cost
// (totalValue / onHand). Free of I/O so it is unit-testable.

export interface ValuationRow {
  onHand: Prisma.Decimal | string | number
  totalValue: Prisma.Decimal | string | number
}

export interface ValuationTotals {
  onHand: Prisma.Decimal
  totalValue: Prisma.Decimal
  avgUnitCost: Prisma.Decimal
}

const ZERO = new Prisma.Decimal(0)

export function aggregateValuation(rows: ReadonlyArray<ValuationRow>): ValuationTotals {
  let onHand = ZERO
  let totalValue = ZERO

  for (const row of rows) {
    onHand = onHand.plus(new Prisma.Decimal(row.onHand))
    totalValue = totalValue.plus(new Prisma.Decimal(row.totalValue))
  }

  const avgUnitCost = onHand.gt(ZERO) ? totalValue.div(onHand) : ZERO

  return { onHand, totalValue, avgUnitCost }
}
