import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierCategoryWriteInput {
  code: string
  name: string
  parentId?: string | null
  description?: string | null
  isActive?: boolean
}

export function listSupplierCategories(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierCategory.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: 'asc' },
  })
}

export function findSupplierCategoryById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierCategory.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createSupplierCategory(
  tenantId: string,
  input: SupplierCategoryWriteInput,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierCategory.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateSupplierCategory(
  tenantId: string,
  id: string,
  data: Partial<SupplierCategoryWriteInput>,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierCategory.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.parentId !== undefined
        ? { parentId: data.parentId ?? null }
        : {}),
      ...(data.description !== undefined
        ? { description: data.description ?? null }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findSupplierCategoryById(tenantId, id, client)
}

export async function softDeleteSupplierCategory(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierCategory.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
