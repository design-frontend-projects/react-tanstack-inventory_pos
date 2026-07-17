import type {
  ResRecipe,
  ResRecipeLine,
  ResRecipeVersion,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on recipe aggregates for the network boundary
// (Prisma.Decimal is a class instance and is not JSON-serializable).

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeRecipe(recipe: ResRecipe) {
  return {
    ...recipe,
    yieldQty: recipe.yieldQty.toString(),
  }
}

export function serializeRecipeVersion(version: ResRecipeVersion) {
  return {
    ...version,
    computedCost: dec(version.computedCost),
  }
}

export function serializeRecipeLine(line: ResRecipeLine) {
  return {
    ...line,
    quantity: line.quantity.toString(),
    wastePercent: line.wastePercent.toString(),
    unitCost: dec(line.unitCost),
  }
}
