import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tags (free-form labels) and groups (coded collections) for customers.

export function listTags(tenantId: string, client: PrismaClientLike = prisma) {
  return client.crmTag.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { name: 'asc' },
  })
}

export function createTag(
  tenantId: string,
  input: { name: string; color?: string | null },
  client: PrismaClientLike = prisma
) {
  return client.crmTag.create({
    data: { tenantId, name: input.name, color: input.color ?? null },
  })
}

export async function updateTag(
  tenantId: string,
  id: string,
  input: { name?: string; color?: string | null },
  client: PrismaClientLike = prisma
) {
  const result = await client.crmTag.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
  })

  return result.count > 0
}

export async function softDeleteTag(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmTag.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  return result.count > 0
}

export function listCustomerTags(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerTag.findMany({
    where: { tenantId, customerId },
    include: { tag: true },
  })
}

export function assignTag(
  tenantId: string,
  customerId: string,
  tagId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerTag.upsert({
    where: { tenantId_customerId_tagId: { tenantId, customerId, tagId } },
    create: { tenantId, customerId, tagId },
    update: {},
  })
}

export async function unassignTag(
  tenantId: string,
  customerId: string,
  tagId: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomerTag.deleteMany({
    where: { tenantId, customerId, tagId },
  })

  return result.count > 0
}

export function listGroups(tenantId: string, client: PrismaClientLike = prisma) {
  return client.crmCustomerGroup.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { code: 'asc' },
    include: { _count: { select: { members: true } } },
  })
}

export function createGroup(
  tenantId: string,
  input: { code: string; name: string; description?: string | null },
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerGroup.create({
    data: {
      tenantId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
    },
  })
}

export async function updateGroup(
  tenantId: string,
  id: string,
  input: { name?: string; description?: string | null },
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomerGroup.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  })

  return result.count > 0
}

export function listGroupMembers(
  tenantId: string,
  groupId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerGroupMember.findMany({
    where: { tenantId, groupId },
    orderBy: { createdAt: 'asc' },
  })
}

export function listCustomerGroupMemberships(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerGroupMember.findMany({
    where: { tenantId, customerId },
    include: { group: true },
  })
}

// Replaces the full membership of a group in one shot (idempotent).
export async function setGroupMembers(
  tenantId: string,
  groupId: string,
  customerIds: Array<string>,
  client: PrismaClientLike = prisma
) {
  await client.crmCustomerGroupMember.deleteMany({ where: { tenantId, groupId } })

  if (customerIds.length === 0) {
    return 0
  }

  const result = await client.crmCustomerGroupMember.createMany({
    data: customerIds.map((customerId) => ({ tenantId, groupId, customerId })),
    skipDuplicates: true,
  })

  return result.count
}
