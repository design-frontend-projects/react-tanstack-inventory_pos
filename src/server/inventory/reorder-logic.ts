import { Prisma } from '#/server/db/generated/prisma/client'

// Pure reorder logic. A line needs replenishing when its available stock
// (on-hand − reserved) has fallen to or below the reorder point. The suggested
// quantity is the configured reorder quantity, or — when only a max is set — the
// amount needed to top back up to max. Kept free of I/O so it is unit-testable.

export type Decimalish = Prisma.Decimal | string | number

export interface ReorderThresholds {
  reorderPoint: Decimalish
  reorderQty: Decimalish
  maxStock: Decimalish
}

export interface ReorderSuggestion {
  available: Prisma.Decimal
  belowPoint: boolean
  suggestedQty: Prisma.Decimal
}

const ZERO = new Prisma.Decimal(0)

export function computeReorderSuggestion(
  onHand: Decimalish,
  reserved: Decimalish,
  thresholds: ReorderThresholds
): ReorderSuggestion {
  const available = new Prisma.Decimal(onHand).minus(new Prisma.Decimal(reserved))
  const reorderPoint = new Prisma.Decimal(thresholds.reorderPoint)
  const reorderQty = new Prisma.Decimal(thresholds.reorderQty)
  const maxStock = new Prisma.Decimal(thresholds.maxStock)

  const belowPoint = available.lte(reorderPoint)

  if (!belowPoint) {
    return { available, belowPoint: false, suggestedQty: ZERO }
  }

  // Prefer an explicit reorder quantity; otherwise top up to max stock.
  let suggestedQty = reorderQty

  if (suggestedQty.lte(ZERO) && maxStock.gt(available)) {
    suggestedQty = maxStock.minus(available)
  }

  return { available, belowPoint: true, suggestedQty }
}
