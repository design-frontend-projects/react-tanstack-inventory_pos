import { prisma } from '#/server/db/client'
import type { ResRestaurantStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResRestaurantWriteInput {
  code: string
  name: string
  legalName?: string | null
  brandColor?: string | null
  logoUrl?: string | null
  defaultCurrency?: string
  defaultLocale?: string
  status?: ResRestaurantStatus
  isActive?: boolean
  createdByProfileId?: string | null
}

export function findRestaurantById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resRestaurant.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listRestaurants(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.resRestaurant.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: 'asc' },
  })
}

export function createRestaurant(
  tenantId: string,
  input: ResRestaurantWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resRestaurant.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      legalName: input.legalName?.trim() ?? null,
      brandColor: input.brandColor ?? null,
      logoUrl: input.logoUrl ?? null,
      defaultCurrency: input.defaultCurrency ?? 'USD',
      defaultLocale: input.defaultLocale ?? 'en',
      status: input.status ?? 'ACTIVE',
      isActive: input.isActive ?? true,
      createdByProfileId: input.createdByProfileId ?? null,
    },
  })
}

export async function updateRestaurant(
  tenantId: string,
  id: string,
  data: Partial<ResRestaurantWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.resRestaurant.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.legalName !== undefined ? { legalName: data.legalName?.trim() ?? null } : {}),
      ...(data.brandColor !== undefined ? { brandColor: data.brandColor ?? null } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl ?? null } : {}),
      ...(data.defaultCurrency !== undefined ? { defaultCurrency: data.defaultCurrency } : {}),
      ...(data.defaultLocale !== undefined ? { defaultLocale: data.defaultLocale } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findRestaurantById(tenantId, id, client)
}

export async function softDeleteRestaurant(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resRestaurant.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
