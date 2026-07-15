import { prisma } from '#/server/db/client'
import type { Prisma, UomType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface UomWriteInput {
  code: string
  name: string
  symbol?: string | null
  uomType: UomType
  isBaseUnit?: boolean
  decimalPlaces?: number
  isActive?: boolean
}

export function findUomById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.unitOfMeasure.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function listUoms(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.unitOfMeasure.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { code: 'asc' },
  })
}

export function createUom(
  tenantId: string,
  input: UomWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.unitOfMeasure.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      symbol: input.symbol ?? null,
      uomType: input.uomType,
      isBaseUnit: input.isBaseUnit ?? false,
      decimalPlaces: input.decimalPlaces ?? 2,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateUom(
  tenantId: string,
  id: string,
  data: Partial<UomWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.unitOfMeasure.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.symbol !== undefined ? { symbol: data.symbol ?? null } : {}),
      ...(data.uomType !== undefined ? { uomType: data.uomType } : {}),
      ...(data.isBaseUnit !== undefined ? { isBaseUnit: data.isBaseUnit } : {}),
      ...(data.decimalPlaces !== undefined ? { decimalPlaces: data.decimalPlaces } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findUomById(tenantId, id, client)
}

export async function softDeleteUom(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.unitOfMeasure.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

export async function upsertUomConversion(
  tenantId: string,
  input: {
    productId?: string | null
    fromUomId: string
    toUomId: string
    factor: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  const existing = await client.uomConversion.findFirst({
    where: {
      tenantId,
      productId: input.productId ?? null,
      fromUomId: input.fromUomId,
      toUomId: input.toUomId,
    },
    select: { id: true },
  })

  if (existing) {
    return client.uomConversion.update({
      where: { id: existing.id },
      data: { factor: input.factor },
    })
  }

  return client.uomConversion.create({
    data: {
      tenantId,
      productId: input.productId ?? null,
      fromUomId: input.fromUomId,
      toUomId: input.toUomId,
      factor: input.factor,
    },
  })
}
