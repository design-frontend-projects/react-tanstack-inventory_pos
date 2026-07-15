import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { ResServiceKind } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResServiceTypeWriteInput {
  branchId?: string | null
  code: string
  name: string
  kind?: ResServiceKind
  settingsJson?: Prisma.InputJsonValue | null
  displayOrder?: number
  isActive?: boolean
}

export function findServiceTypeById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resServiceType.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listServiceTypes(
  tenantId: string,
  options: { branchId?: string | null } = {},
  client: PrismaClientLike = prisma
) {
  return client.resServiceType.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(options.branchId !== undefined ? { branchId: options.branchId } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createServiceType(
  tenantId: string,
  input: ResServiceTypeWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resServiceType.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      kind: input.kind ?? 'DINE_IN',
      settingsJson: input.settingsJson ?? undefined,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateServiceType(
  tenantId: string,
  id: string,
  data: Partial<ResServiceTypeWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.resServiceType.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.settingsJson !== undefined
        ? { settingsJson: data.settingsJson ?? Prisma.DbNull }
        : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findServiceTypeById(tenantId, id, client)
}

export async function softDeleteServiceType(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resServiceType.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
