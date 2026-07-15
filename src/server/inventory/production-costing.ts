import { Prisma } from '#/server/db/generated/prisma/client'

// Pure cost roll-up for manufacturing. The finished-good unit cost is the total
// consumed material cost plus overhead, spread over the produced quantity. Kept
// free of I/O so it is trivially unit-testable; the resulting unit cost flows into
// the finished product's weighted average through a normal PRODUCTION_OUTPUT
// receipt.

export type Decimalish = Prisma.Decimal | string | number

const ZERO = new Prisma.Decimal(0)

// Explodes a BOM component to the quantity needed for a production run:
// perOutput × (plannedQty / bomOutputQty) × (1 + scrap%). Scrap is expressed as a
// fraction (0.05 = 5%).
export function explodeComponentQty(
  perOutputQty: Decimalish,
  scrapPercent: Decimalish,
  plannedQty: Decimalish,
  bomOutputQty: Decimalish
): Prisma.Decimal {
  const output = new Prisma.Decimal(bomOutputQty)

  if (output.lte(ZERO)) {
    throw new Error('BOM output quantity must be positive.')
  }

  const scale = new Prisma.Decimal(plannedQty).div(output)
  const scrapMultiplier = new Prisma.Decimal(1).plus(new Prisma.Decimal(scrapPercent))

  return new Prisma.Decimal(perOutputQty).times(scale).times(scrapMultiplier)
}

// Finished-good unit cost = (material cost + overhead) / produced quantity. Zero
// produced quantity yields a zero unit cost rather than dividing by zero.
export function rollupOutputUnitCost(
  materialCost: Decimalish,
  overheadCost: Decimalish,
  producedQty: Decimalish
): Prisma.Decimal {
  const produced = new Prisma.Decimal(producedQty)

  if (produced.lte(ZERO)) {
    return ZERO
  }

  return new Prisma.Decimal(materialCost).plus(new Prisma.Decimal(overheadCost)).div(produced)
}
