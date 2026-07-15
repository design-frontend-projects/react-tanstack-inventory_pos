import { prisma } from '#/server/db/client'
import type { ResRecipeStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResRecipeWriteInput {
  menuItemId: string
  variantId?: string | null
  code: string
  name: string
  status?: ResRecipeStatus
  yieldQty?: string | number
  yieldUomId?: string | null
}

export interface ResRecipeLineWriteInput {
  versionId: string
  productId: string
  variantId?: string | null
  uomId?: string | null
  quantity: string | number
  wastePercent?: string | number
  isOptional?: boolean
  displayOrder?: number
}

export function findRecipeById(tenantId: string, id: string, client: PrismaClientLike = prisma) {
  return client.resRecipe.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listRecipes(
  tenantId: string,
  options: { menuItemId?: string; status?: ResRecipeStatus } = {},
  client: PrismaClientLike = prisma
) {
  return client.resRecipe.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.menuItemId ? { menuItemId: options.menuItemId } : {}),
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export function createRecipe(
  tenantId: string,
  input: ResRecipeWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resRecipe.create({
    data: {
      tenantId,
      menuItemId: input.menuItemId,
      variantId: input.variantId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      status: input.status ?? 'DRAFT',
      yieldQty: input.yieldQty ?? 1,
      yieldUomId: input.yieldUomId ?? null,
    },
  })
}

export async function nextVersionNo(
  tenantId: string,
  recipeId: string,
  client: PrismaClientLike = prisma
): Promise<number> {
  const last = await client.resRecipeVersion.findFirst({
    where: { tenantId, recipeId },
    orderBy: { versionNo: 'desc' },
    select: { versionNo: true },
  })
  return (last?.versionNo ?? 0) + 1
}

export function createVersion(
  tenantId: string,
  input: { recipeId: string; versionNo: number; notes?: string | null },
  client: PrismaClientLike = prisma
) {
  return client.resRecipeVersion.create({
    data: {
      tenantId,
      recipeId: input.recipeId,
      versionNo: input.versionNo,
      notes: input.notes ?? null,
    },
  })
}

export function findVersionById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resRecipeVersion.findFirst({ where: { id, tenantId } })
}

export function listLines(
  tenantId: string,
  versionId: string,
  client: PrismaClientLike = prisma
) {
  return client.resRecipeLine.findMany({
    where: { tenantId, versionId },
    orderBy: { displayOrder: 'asc' },
  })
}

export function createLine(
  tenantId: string,
  input: ResRecipeLineWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resRecipeLine.create({
    data: {
      tenantId,
      versionId: input.versionId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      uomId: input.uomId ?? null,
      quantity: input.quantity,
      wastePercent: input.wastePercent ?? 0,
      isOptional: input.isOptional ?? false,
      displayOrder: input.displayOrder ?? 0,
    },
  })
}

export function listSubRecipes(
  tenantId: string,
  parentVersionId: string,
  client: PrismaClientLike = prisma
) {
  return client.resRecipeSubRecipe.findMany({
    where: { tenantId, parentVersionId },
    orderBy: { displayOrder: 'asc' },
  })
}

export function addStep(
  tenantId: string,
  input: { versionId: string; stepNo: number; instruction: string; durationMin?: number | null },
  client: PrismaClientLike = prisma
) {
  return client.resRecipeStep.create({
    data: {
      tenantId,
      versionId: input.versionId,
      stepNo: input.stepNo,
      instruction: input.instruction.trim(),
      durationMin: input.durationMin ?? null,
    },
  })
}

export async function setVersionCost(
  tenantId: string,
  versionId: string,
  cost: string,
  client: PrismaClientLike = prisma
) {
  await client.resRecipeVersion.updateMany({
    where: { id: versionId, tenantId },
    data: { computedCost: cost, costComputedAt: new Date() },
  })
}

// Approve a version: mark it approved + current, demote siblings, flip recipe status.
export async function approveVersion(
  tenantId: string,
  input: { recipeId: string; versionId: string; approvedByProfileId?: string | null },
  client: PrismaClientLike = prisma
) {
  await client.resRecipeVersion.updateMany({
    where: { tenantId, recipeId: input.recipeId },
    data: { isCurrent: false },
  })
  await client.resRecipeVersion.updateMany({
    where: { id: input.versionId, tenantId, recipeId: input.recipeId },
    data: {
      isCurrent: true,
      approvedByProfileId: input.approvedByProfileId ?? null,
      approvedAt: new Date(),
    },
  })
  await client.resRecipe.updateMany({
    where: { id: input.recipeId, tenantId },
    data: { status: 'APPROVED', currentVersionId: input.versionId },
  })
  return findRecipeById(tenantId, input.recipeId, client)
}
