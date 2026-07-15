import { prisma } from '#/server/db/client'
import { NotFoundError } from '#/server/auth/errors'
import { computeRecipeCost } from '#/server/restaurant/recipes/recipe-cost'
import type { RecipeCostLine } from '#/server/restaurant/recipes/recipe-cost'
import * as recipeRepo from '#/server/repos/res-recipe-repo'
import type { CurrentUserContext } from '#/types/auth'

// --- Recipes ----------------------------------------------------------------

export function listRecipes(
  _context: CurrentUserContext,
  tenantId: string,
  menuItemId?: string
) {
  return recipeRepo.listRecipes(tenantId, { menuItemId })
}

// Create a recipe together with its first (draft) version, atomically.
export async function createRecipe(
  _context: CurrentUserContext,
  tenantId: string,
  input: recipeRepo.ResRecipeWriteInput & { notes?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    const recipe = await recipeRepo.createRecipe(tenantId, input, tx)
    const version = await recipeRepo.createVersion(
      tenantId,
      { recipeId: recipe.id, versionNo: 1, notes: input.notes ?? null },
      tx
    )
    return { recipe, version }
  })
}

export async function getRecipe(_context: CurrentUserContext, tenantId: string, id: string) {
  const recipe = await recipeRepo.findRecipeById(tenantId, id)
  if (!recipe) {
    throw new NotFoundError('Recipe not found')
  }
  return recipe
}

export async function addVersion(
  _context: CurrentUserContext,
  tenantId: string,
  input: { recipeId: string; notes?: string | null }
) {
  const recipe = await recipeRepo.findRecipeById(tenantId, input.recipeId)
  if (!recipe) {
    throw new NotFoundError('Recipe not found')
  }
  const versionNo = await recipeRepo.nextVersionNo(tenantId, input.recipeId)
  return recipeRepo.createVersion(tenantId, {
    recipeId: input.recipeId,
    versionNo,
    notes: input.notes ?? null,
  })
}

export async function addLine(
  _context: CurrentUserContext,
  tenantId: string,
  input: recipeRepo.ResRecipeLineWriteInput
) {
  const version = await recipeRepo.findVersionById(tenantId, input.versionId)
  if (!version) {
    throw new NotFoundError('Recipe version not found')
  }
  return recipeRepo.createLine(tenantId, input)
}

export async function addStep(
  _context: CurrentUserContext,
  tenantId: string,
  input: { versionId: string; stepNo: number; instruction: string; durationMin?: number | null }
) {
  return recipeRepo.addStep(tenantId, input)
}

// Recompute a version's cost from its lines and sub-recipes. Ingredient unit
// costs come from the line override or the inventory product's standardCost —
// inventory remains the owner of costing (restaurant never caches stale cost).
export async function computeCost(
  _context: CurrentUserContext,
  tenantId: string,
  versionId: string
) {
  const version = await recipeRepo.findVersionById(tenantId, versionId)
  if (!version) {
    throw new NotFoundError('Recipe version not found')
  }

  const lines = await recipeRepo.listLines(tenantId, versionId)
  const productIds = [...new Set(lines.map((line) => line.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true, standardCost: true },
  })
  const costById = new Map(products.map((p) => [p.id, p.standardCost?.toString() ?? '0']))

  const costLines: Array<RecipeCostLine> = lines.map((line) => ({
    quantity: line.quantity.toString(),
    wastePercent: line.wastePercent.toString(),
    unitCost: line.unitCost?.toString() ?? costById.get(line.productId) ?? '0',
    isOptional: line.isOptional,
  }))

  const subs = await recipeRepo.listSubRecipes(tenantId, versionId)
  const subCosts = await Promise.all(
    subs.map(async (sub) => {
      const child = await recipeRepo.findRecipeById(tenantId, sub.childRecipeId)
      let cost = '0'
      if (child?.currentVersionId) {
        const childVersion = await recipeRepo.findVersionById(tenantId, child.currentVersionId)
        cost = childVersion?.computedCost?.toString() ?? '0'
      }
      return { quantity: sub.quantity.toString(), cost }
    })
  )

  const result = computeRecipeCost(costLines, subCosts)
  await recipeRepo.setVersionCost(tenantId, versionId, result.totalCost)
  return { versionId, ...result }
}

export async function approveVersion(
  context: CurrentUserContext,
  tenantId: string,
  input: { recipeId: string; versionId: string }
) {
  const recipe = await recipeRepo.findRecipeById(tenantId, input.recipeId)
  if (!recipe) {
    throw new NotFoundError('Recipe not found')
  }
  return recipeRepo.approveVersion(tenantId, {
    recipeId: input.recipeId,
    versionId: input.versionId,
    approvedByProfileId: context.profileId,
  })
}
