import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { WarehouseType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface WarehouseWriteInput {
  code: string
  name: string
  warehouseType?: WarehouseType
  addressJson?: Prisma.InputJsonValue | null
  isDefault?: boolean
  allowNegativeStock?: boolean
  isActive?: boolean
}

export function findWarehouseById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.warehouse.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listWarehouses(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.warehouse.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: 'asc' },
  })
}

export function createWarehouse(
  tenantId: string,
  input: WarehouseWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.warehouse.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      warehouseType: input.warehouseType ?? 'WAREHOUSE',
      addressJson: input.addressJson ?? undefined,
      isDefault: input.isDefault ?? false,
      allowNegativeStock: input.allowNegativeStock ?? false,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateWarehouse(
  tenantId: string,
  id: string,
  data: Partial<WarehouseWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.warehouse.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.warehouseType !== undefined ? { warehouseType: data.warehouseType } : {}),
      ...(data.addressJson !== undefined
        ? { addressJson: data.addressJson ?? Prisma.DbNull }
        : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      ...(data.allowNegativeStock !== undefined
        ? { allowNegativeStock: data.allowNegativeStock }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findWarehouseById(tenantId, id, client)
}

export async function softDeleteWarehouse(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.warehouse.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
