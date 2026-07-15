import { prisma } from '#/server/db/client'
import type { LocationType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface LocationWriteInput {
  warehouseId: string
  code: string
  name: string
  locationType?: LocationType
  parentId?: string | null
  isStockable?: boolean
  isPickable?: boolean
  pickSequence?: number | null
  isActive?: boolean
}

export function findLocationById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.warehouseLocation.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function listLocations(
  tenantId: string,
  warehouseId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.warehouseLocation.findMany({
    where: {
      tenantId,
      warehouseId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ depth: 'asc' }, { code: 'asc' }],
  })
}

// Materialized dot-path + depth from the parent so subtree reads stay cheap
// without recursion (ltree/GIST deferred to a later scale phase).
async function resolveHierarchy(
  tenantId: string,
  parentId: string | null | undefined,
  id: string,
  client: PrismaClientLike
): Promise<{ path: string; depth: number }> {
  if (!parentId) {
    return { path: id, depth: 0 }
  }

  const parent = await client.warehouseLocation.findFirst({
    where: { id: parentId, tenantId, deletedAt: null },
    select: { path: true, depth: true },
  })

  if (!parent) {
    return { path: id, depth: 0 }
  }

  return { path: `${parent.path ?? parent.depth}.${id}`, depth: parent.depth + 1 }
}

export async function createLocation(
  tenantId: string,
  input: LocationWriteInput,
  client: PrismaClientLike = prisma
) {
  const created = await client.warehouseLocation.create({
    data: {
      tenantId,
      warehouseId: input.warehouseId,
      code: input.code.trim(),
      name: input.name.trim(),
      locationType: input.locationType ?? 'BIN',
      parentId: input.parentId ?? null,
      isStockable: input.isStockable ?? true,
      isPickable: input.isPickable ?? true,
      pickSequence: input.pickSequence ?? null,
      isActive: input.isActive ?? true,
    },
  })

  const hierarchy = await resolveHierarchy(tenantId, created.parentId, created.id, client)

  return client.warehouseLocation.update({
    where: { id: created.id },
    data: hierarchy,
  })
}

export async function updateLocation(
  tenantId: string,
  id: string,
  data: Partial<Omit<LocationWriteInput, 'warehouseId'>>,
  client: PrismaClientLike = prisma
) {
  const result = await client.warehouseLocation.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.locationType !== undefined ? { locationType: data.locationType } : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId ?? null } : {}),
      ...(data.isStockable !== undefined ? { isStockable: data.isStockable } : {}),
      ...(data.isPickable !== undefined ? { isPickable: data.isPickable } : {}),
      ...(data.pickSequence !== undefined ? { pickSequence: data.pickSequence ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  if (data.parentId !== undefined) {
    const hierarchy = await resolveHierarchy(tenantId, data.parentId ?? null, id, client)
    await client.warehouseLocation.update({ where: { id }, data: hierarchy })
  }

  return findLocationById(tenantId, id, client)
}

export async function softDeleteLocation(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.warehouseLocation.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
