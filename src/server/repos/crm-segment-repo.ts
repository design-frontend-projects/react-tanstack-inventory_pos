import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Segments (declarative rules) and their materialized membership.

export function listSegments(tenantId: string, client: PrismaClientLike = prisma) {
  return client.crmSegment.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { code: 'asc' },
  })
}

export function findSegmentById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.crmSegment.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listActiveSegments(tenantId: string, client: PrismaClientLike = prisma) {
  return client.crmSegment.findMany({
    where: { tenantId, deletedAt: null, isActive: true },
  })
}

export interface SegmentWriteInput {
  code: string
  name: string
  description?: string | null
  ruleJson: Prisma.InputJsonValue
  isActive?: boolean
}

export function createSegment(
  tenantId: string,
  input: SegmentWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.crmSegment.create({
    data: {
      tenantId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      ruleJson: input.ruleJson,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateSegment(
  tenantId: string,
  id: string,
  input: Partial<SegmentWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmSegment.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.ruleJson !== undefined ? { ruleJson: input.ruleJson } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })

  return result.count > 0
}

export async function softDeleteSegment(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmSegment.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  return result.count > 0
}

export async function setSegmentStats(
  id: string,
  memberCount: number,
  lastRebuiltAt: Date,
  client: PrismaClientLike = prisma
) {
  await client.crmSegment.update({
    where: { id },
    data: { memberCount, lastRebuiltAt },
  })
}

export function isMember(
  tenantId: string,
  segmentId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmSegmentMember.findUnique({
    where: {
      tenantId_segmentId_customerId: { tenantId, segmentId, customerId },
    },
  })
}

export async function addMember(
  tenantId: string,
  segmentId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  await client.crmSegmentMember.upsert({
    where: {
      tenantId_segmentId_customerId: { tenantId, segmentId, customerId },
    },
    create: { tenantId, segmentId, customerId },
    update: {},
  })
}

export async function removeMember(
  tenantId: string,
  segmentId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmSegmentMember.deleteMany({
    where: { tenantId, segmentId, customerId },
  })

  return result.count > 0
}

export function listMembers(
  tenantId: string,
  segmentId: string,
  take = 100,
  client: PrismaClientLike = prisma
) {
  return client.crmSegmentMember.findMany({
    where: { tenantId, segmentId },
    orderBy: { addedAt: 'desc' },
    take: Math.min(take, 500),
  })
}

export function countMembers(
  tenantId: string,
  segmentId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmSegmentMember.count({ where: { tenantId, segmentId } })
}

export async function replaceMembers(
  tenantId: string,
  segmentId: string,
  customerIds: Array<string>,
  client: PrismaClientLike = prisma
) {
  await client.crmSegmentMember.deleteMany({ where: { tenantId, segmentId } })

  if (customerIds.length === 0) {
    return 0
  }

  const result = await client.crmSegmentMember.createMany({
    data: customerIds.map((customerId) => ({ tenantId, segmentId, customerId })),
    skipDuplicates: true,
  })

  return result.count
}
