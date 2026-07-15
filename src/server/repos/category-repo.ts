import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface CategoryWriteInput {
  code: string
  name: string
  parentId?: string | null
  displayOrder?: number
  isActive?: boolean
}

export function findCategoryById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.productCategory.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function listCategories(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.productCategory.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ depth: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
  })
}

// Builds the dot-separated materialized `path` and `depth` from the parent so
// subtree reads are cheap without recursion. Kept in app code (no ltree in
// Phase 1); warehouse locations adopt ltree in Phase 2 where subtree rollups
// justify it.
async function resolveHierarchy(
  tenantId: string,
  parentId: string | null | undefined,
  id: string,
  client: PrismaClientLike
): Promise<{ path: string; depth: number }> {
  if (!parentId) {
    return { path: id, depth: 0 }
  }

  const parent = await client.productCategory.findFirst({
    where: { id: parentId, tenantId, deletedAt: null },
    select: { path: true, depth: true },
  })

  if (!parent) {
    return { path: id, depth: 0 }
  }

  return {
    path: `${parent.path ?? parent.depth}.${id}`,
    depth: parent.depth + 1,
  }
}

export async function createCategory(
  tenantId: string,
  input: CategoryWriteInput,
  client: PrismaClientLike = prisma
) {
  const created = await client.productCategory.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      parentId: input.parentId ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })

  const hierarchy = await resolveHierarchy(
    tenantId,
    created.parentId,
    created.id,
    client
  )

  return client.productCategory.update({
    where: { id: created.id },
    data: hierarchy,
  })
}

export async function updateCategory(
  tenantId: string,
  id: string,
  data: Partial<CategoryWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.productCategory.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId ?? null } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  if (data.parentId !== undefined) {
    const hierarchy = await resolveHierarchy(tenantId, data.parentId ?? null, id, client)
    await client.productCategory.update({ where: { id }, data: hierarchy })
  }

  return findCategoryById(tenantId, id, client)
}

export async function softDeleteCategory(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.productCategory.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
