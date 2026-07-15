import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResKitchenStationWriteInput {
  branchId: string
  code: string
  name: string
  displayOrder?: number
  isActive?: boolean
}

export function findKitchenStationById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resKitchenStation.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listKitchenStations(
  tenantId: string,
  branchId: string,
  client: PrismaClientLike = prisma
) {
  return client.resKitchenStation.findMany({
    where: { tenantId, branchId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createKitchenStation(
  tenantId: string,
  input: ResKitchenStationWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resKitchenStation.create({
    data: {
      tenantId,
      branchId: input.branchId,
      code: input.code.trim(),
      name: input.name.trim(),
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateKitchenStation(
  tenantId: string,
  id: string,
  data: Partial<ResKitchenStationWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.resKitchenStation.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findKitchenStationById(tenantId, id, client)
}

export async function softDeleteKitchenStation(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resKitchenStation.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
