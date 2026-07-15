import { prisma } from '#/server/db/client'
import type {
  ResComboPricingType,
  ResCrossSellType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResComboWriteInput {
  branchId?: string | null
  code: string
  name: string
  description?: string | null
  pricingType?: ResComboPricingType
  price?: string | number | null
  isActive?: boolean
}

export function findComboById(tenantId: string, id: string, client: PrismaClientLike = prisma) {
  return client.resCombo.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listCombos(
  tenantId: string,
  options: { branchId?: string | null } = {},
  client: PrismaClientLike = prisma
) {
  return client.resCombo.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(options.branchId !== undefined ? { branchId: options.branchId } : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export function createCombo(
  tenantId: string,
  input: ResComboWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resCombo.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description ?? null,
      pricingType: input.pricingType ?? 'FIXED',
      price: input.price ?? null,
      isActive: input.isActive ?? true,
    },
  })
}

export function listComboComponents(
  tenantId: string,
  comboId: string,
  client: PrismaClientLike = prisma
) {
  return client.resComboComponent.findMany({
    where: { tenantId, comboId },
    orderBy: { displayOrder: 'asc' },
  })
}

export function addComboComponent(
  tenantId: string,
  input: {
    comboId: string
    menuItemId: string
    quantity?: number
    priceDelta?: string | number | null
    isSwappable?: boolean
    groupLabel?: string | null
    displayOrder?: number
  },
  client: PrismaClientLike = prisma
) {
  return client.resComboComponent.create({
    data: {
      tenantId,
      comboId: input.comboId,
      menuItemId: input.menuItemId,
      quantity: input.quantity ?? 1,
      priceDelta: input.priceDelta ?? null,
      isSwappable: input.isSwappable ?? false,
      groupLabel: input.groupLabel ?? null,
      displayOrder: input.displayOrder ?? 0,
    },
  })
}

// --- Cross / up-sell links --------------------------------------------------

export function listCrossSells(
  tenantId: string,
  sourceItemId: string,
  client: PrismaClientLike = prisma
) {
  return client.resCrossSell.findMany({
    where: { tenantId, sourceItemId },
    orderBy: { displayOrder: 'asc' },
  })
}

export function createCrossSell(
  tenantId: string,
  input: {
    sourceItemId: string
    targetItemId: string
    relationType?: ResCrossSellType
    displayOrder?: number
  },
  client: PrismaClientLike = prisma
) {
  return client.resCrossSell.create({
    data: {
      tenantId,
      sourceItemId: input.sourceItemId,
      targetItemId: input.targetItemId,
      relationType: input.relationType ?? 'RELATED',
      displayOrder: input.displayOrder ?? 0,
    },
  })
}
