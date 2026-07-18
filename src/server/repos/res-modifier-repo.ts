import { prisma } from '#/server/db/client'
import type { ResModifierSelectionType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResModifierGroupWriteInput {
  branchId?: string | null
  code: string
  name: string
  selectionType?: ResModifierSelectionType
  minSelect?: number
  maxSelect?: number | null
  isRequired?: boolean
  displayOrder?: number
  isActive?: boolean
}

export interface ResModifierWriteInput {
  groupId: string
  productId?: string | null
  code: string
  name: string
  priceDelta?: string | number
  isDefault?: boolean
  displayOrder?: number
  isActive?: boolean
}

export function findModifierGroupById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resModifierGroup.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listModifierGroups(
  tenantId: string,
  options: { branchId?: string | null } = {},
  client: PrismaClientLike = prisma
) {
  return client.resModifierGroup.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(options.branchId !== undefined ? { branchId: options.branchId } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createModifierGroup(
  tenantId: string,
  input: ResModifierGroupWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resModifierGroup.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      selectionType: input.selectionType ?? 'SINGLE',
      minSelect: input.minSelect ?? 0,
      maxSelect: input.maxSelect ?? null,
      isRequired: input.isRequired ?? false,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}

export function listModifierGroupsByIds(
  tenantId: string,
  ids: ReadonlyArray<string>,
  client: PrismaClientLike = prisma
) {
  if (ids.length === 0) {
    return Promise.resolve([])
  }

  return client.resModifierGroup.findMany({
    where: { tenantId, id: { in: [...ids] }, deletedAt: null },
  })
}

export function listModifiersByGroupIds(
  tenantId: string,
  groupIds: ReadonlyArray<string>,
  client: PrismaClientLike = prisma
) {
  if (groupIds.length === 0) {
    return Promise.resolve([])
  }

  return client.resModifier.findMany({
    where: { tenantId, groupId: { in: [...groupIds] }, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function listModifiers(
  tenantId: string,
  groupId: string,
  client: PrismaClientLike = prisma
) {
  return client.resModifier.findMany({
    where: { tenantId, groupId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createModifier(
  tenantId: string,
  input: ResModifierWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resModifier.create({
    data: {
      tenantId,
      groupId: input.groupId,
      productId: input.productId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      priceDelta: input.priceDelta ?? 0,
      isDefault: input.isDefault ?? false,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}
