import { prisma } from '#/server/db/client'
import type { Prisma, TaxType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface TaxRateWriteInput {
  code: string
  name: string
  rate: Prisma.Decimal | string | number
  taxType?: TaxType
  isCompound?: boolean
  isInclusive?: boolean
  isActive?: boolean
}

export function findTaxRateById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.taxRate.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function listTaxRates(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.taxRate.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { code: 'asc' },
  })
}

export function createTaxRate(
  tenantId: string,
  input: TaxRateWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.taxRate.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      rate: input.rate,
      taxType: input.taxType ?? 'VAT',
      isCompound: input.isCompound ?? false,
      isInclusive: input.isInclusive ?? false,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateTaxRate(
  tenantId: string,
  id: string,
  data: Partial<TaxRateWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.taxRate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.rate !== undefined ? { rate: data.rate } : {}),
      ...(data.taxType !== undefined ? { taxType: data.taxType } : {}),
      ...(data.isCompound !== undefined ? { isCompound: data.isCompound } : {}),
      ...(data.isInclusive !== undefined ? { isInclusive: data.isInclusive } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findTaxRateById(tenantId, id, client)
}

export async function softDeleteTaxRate(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.taxRate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
