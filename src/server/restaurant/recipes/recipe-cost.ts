import { Prisma } from '#/server/db/generated/prisma/client'

// Pure recipe-cost calculation. Kept free of DB access so it is exhaustively
// testable; the service resolves ingredient unit costs from inventory and feeds
// them in. All arithmetic uses Prisma.Decimal to preserve precision.
//
// Line cost = quantity × (1 + wastePercent) × unitCost.
// Optional lines are excluded from the mandatory cost by default.
// Sub-recipe cost = quantity × childRecipeCost.

export interface RecipeCostLine {
  quantity: string
  wastePercent: string
  unitCost: string
  isOptional?: boolean
}

export interface RecipeSubCost {
  quantity: string
  cost: string
}

export interface RecipeCostResult {
  totalCost: string
  optionalCost: string
}

export function computeRecipeCost(
  lines: ReadonlyArray<RecipeCostLine>,
  subRecipes: ReadonlyArray<RecipeSubCost> = []
): RecipeCostResult {
  const one = new Prisma.Decimal(1)
  let total = new Prisma.Decimal(0)
  let optional = new Prisma.Decimal(0)

  for (const line of lines) {
    const qty = new Prisma.Decimal(line.quantity)
    const waste = new Prisma.Decimal(line.wastePercent)
    const unit = new Prisma.Decimal(line.unitCost)
    const lineCost = qty.times(one.plus(waste)).times(unit)
    if (line.isOptional) {
      optional = optional.plus(lineCost)
    } else {
      total = total.plus(lineCost)
    }
  }

  for (const sub of subRecipes) {
    total = total.plus(new Prisma.Decimal(sub.quantity).times(new Prisma.Decimal(sub.cost)))
  }

  return { totalCost: total.toString(), optionalCost: optional.toString() }
}
