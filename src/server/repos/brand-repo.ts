import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface BrandWriteInput {
  code: string
  name: string
  logoUrl?: string | null
  isActive?: boolean
}

export function findBrandById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.brand.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function listBrands(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.brand.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: 'asc' },
  })
}

export function createBrand(
  tenantId: string,
  input: BrandWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.brand.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      logoUrl: input.logoUrl ?? null,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateBrand(
  tenantId: string,
  id: string,
  data: Partial<BrandWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.brand.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findBrandById(tenantId, id, client)
}

export async function softDeleteBrand(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.brand.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
