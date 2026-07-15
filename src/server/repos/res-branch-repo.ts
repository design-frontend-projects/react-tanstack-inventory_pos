import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { ResBranchStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResBranchWriteInput {
  restaurantId: string
  warehouseId?: string | null
  code: string
  name: string
  addressJson?: Prisma.InputJsonValue | null
  phone?: string | null
  timezone?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
  currencyCode?: string
  isDefault?: boolean
  status?: ResBranchStatus
  isActive?: boolean
  createdByProfileId?: string | null
}

export function findBranchById(tenantId: string, id: string, client: PrismaClientLike = prisma) {
  return client.resBranch.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listBranches(
  tenantId: string,
  options: { restaurantId?: string; includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.resBranch.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.restaurantId ? { restaurantId: options.restaurantId } : {}),
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { name: 'asc' },
  })
}

export function createBranch(
  tenantId: string,
  input: ResBranchWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resBranch.create({
    data: {
      tenantId,
      restaurantId: input.restaurantId,
      warehouseId: input.warehouseId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      addressJson: input.addressJson ?? undefined,
      phone: input.phone ?? null,
      timezone: input.timezone ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      isDefault: input.isDefault ?? false,
      status: input.status ?? 'ACTIVE',
      isActive: input.isActive ?? true,
      createdByProfileId: input.createdByProfileId ?? null,
    },
  })
}

export async function updateBranch(
  tenantId: string,
  id: string,
  data: Partial<ResBranchWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.resBranch.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.warehouseId !== undefined ? { warehouseId: data.warehouseId ?? null } : {}),
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.addressJson !== undefined
        ? { addressJson: data.addressJson ?? Prisma.DbNull }
        : {}),
      ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone ?? null } : {}),
      ...(data.latitude !== undefined ? { latitude: data.latitude ?? null } : {}),
      ...(data.longitude !== undefined ? { longitude: data.longitude ?? null } : {}),
      ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findBranchById(tenantId, id, client)
}

export async function softDeleteBranch(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resBranch.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

// --- Branch members ---------------------------------------------------------

export function listBranchMembers(
  tenantId: string,
  branchId: string,
  client: PrismaClientLike = prisma
) {
  return client.resBranchMember.findMany({
    where: { tenantId, branchId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
}

export function isBranchMember(
  tenantId: string,
  branchId: string,
  profileId: string,
  client: PrismaClientLike = prisma
) {
  return client.resBranchMember.findFirst({
    where: { tenantId, branchId, profileId, isActive: true },
  })
}

export function upsertBranchMember(
  tenantId: string,
  input: { branchId: string; profileId: string; roleCode?: string | null; isActive?: boolean },
  client: PrismaClientLike = prisma
) {
  return client.resBranchMember.upsert({
    where: {
      tenantId_branchId_profileId: {
        tenantId,
        branchId: input.branchId,
        profileId: input.profileId,
      },
    },
    create: {
      tenantId,
      branchId: input.branchId,
      profileId: input.profileId,
      roleCode: input.roleCode ?? null,
      isActive: input.isActive ?? true,
    },
    update: {
      roleCode: input.roleCode ?? null,
      isActive: input.isActive ?? true,
    },
  })
}
