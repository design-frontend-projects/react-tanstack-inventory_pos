import { prisma } from '#/server/db/client'
import type { ResTableStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Table hierarchy: dining area -> section -> table (+ optional QR code).

export interface ResDiningAreaWriteInput {
  branchId: string
  code: string
  name: string
  displayOrder?: number
  isActive?: boolean
}

export interface ResTableSectionWriteInput {
  branchId: string
  diningAreaId: string
  code: string
  name: string
  displayOrder?: number
  isActive?: boolean
}

export interface ResTableWriteInput {
  branchId: string
  sectionId: string
  code: string
  seats?: number
  minCapacity?: number | null
  shape?: string | null
  status?: ResTableStatus
  isActive?: boolean
}

// --- Dining areas -----------------------------------------------------------

export function listDiningAreas(
  tenantId: string,
  branchId: string,
  client: PrismaClientLike = prisma
) {
  return client.resDiningArea.findMany({
    where: { tenantId, branchId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createDiningArea(
  tenantId: string,
  input: ResDiningAreaWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resDiningArea.create({
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

// --- Table sections ---------------------------------------------------------

export function listTableSections(
  tenantId: string,
  branchId: string,
  client: PrismaClientLike = prisma
) {
  return client.resTableSection.findMany({
    where: { tenantId, branchId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createTableSection(
  tenantId: string,
  input: ResTableSectionWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resTableSection.create({
    data: {
      tenantId,
      branchId: input.branchId,
      diningAreaId: input.diningAreaId,
      code: input.code.trim(),
      name: input.name.trim(),
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}

// --- Tables -----------------------------------------------------------------

export function findTableById(tenantId: string, id: string, client: PrismaClientLike = prisma) {
  return client.resTable.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listTables(
  tenantId: string,
  branchId: string,
  client: PrismaClientLike = prisma
) {
  return client.resTable.findMany({
    where: { tenantId, branchId, deletedAt: null, isActive: true },
    orderBy: { code: 'asc' },
  })
}

export function createTable(
  tenantId: string,
  input: ResTableWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resTable.create({
    data: {
      tenantId,
      branchId: input.branchId,
      sectionId: input.sectionId,
      code: input.code.trim(),
      seats: input.seats ?? 2,
      minCapacity: input.minCapacity ?? null,
      shape: input.shape ?? null,
      status: input.status ?? 'AVAILABLE',
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateTable(
  tenantId: string,
  id: string,
  data: Partial<ResTableWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.resTable.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.seats !== undefined ? { seats: data.seats } : {}),
      ...(data.minCapacity !== undefined ? { minCapacity: data.minCapacity ?? null } : {}),
      ...(data.shape !== undefined ? { shape: data.shape ?? null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findTableById(tenantId, id, client)
}

export async function softDeleteTable(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resTable.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
