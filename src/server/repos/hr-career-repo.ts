import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for the career & succession sub-domain: career
// paths (position-to-position progression), succession candidates per critical
// position, and employee promotions. All reads filter by tenantId.

// --- Career paths -----------------------------------------------------------

export interface CareerPathWriteInput {
  code: string
  name: string
  fromPositionId?: string | null
  toPositionId?: string | null
  minYears?: string | number | null
  requirements?: string | null
  statusCode?: string
  isActive?: boolean
}

export function listCareerPaths(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrCareerPath.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { name: 'asc' },
    take: 300,
  })
}

export function findCareerPathById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrCareerPath.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createCareerPath(
  tenantId: string,
  input: CareerPathWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrCareerPath.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      fromPositionId: input.fromPositionId ?? null,
      toPositionId: input.toPositionId ?? null,
      minYears: input.minYears ?? null,
      requirements: input.requirements ?? null,
      statusCode: input.statusCode ?? 'active',
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateCareerPath(
  tenantId: string,
  id: string,
  input: Partial<CareerPathWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCareerPath.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.fromPositionId !== undefined
        ? { fromPositionId: input.fromPositionId ?? null }
        : {}),
      ...(input.toPositionId !== undefined
        ? { toPositionId: input.toPositionId ?? null }
        : {}),
      ...(input.minYears !== undefined
        ? { minYears: input.minYears ?? null }
        : {}),
      ...(input.requirements !== undefined
        ? { requirements: input.requirements ?? null }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findCareerPathById(tenantId, id, client)
}

export async function softDeleteCareerPath(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCareerPath.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
  })
  return result.count > 0
}

// --- Successors -------------------------------------------------------------

export interface SuccessorWriteInput {
  positionId: string
  employeeId: string
  readinessLevel?: string
  readinessMonths?: number | null
  priority?: number
  notes?: string | null
  statusCode?: string
}

export function listSuccessors(
  tenantId: string,
  filters: { positionId?: string; employeeId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrSuccessor.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.positionId ? { positionId: filters.positionId } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    orderBy: [{ positionId: 'asc' }, { priority: 'asc' }],
    take: 500,
  })
}

export function findSuccessorById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrSuccessor.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createSuccessor(
  tenantId: string,
  input: SuccessorWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrSuccessor.create({
    data: {
      tenantId,
      positionId: input.positionId,
      employeeId: input.employeeId,
      readinessLevel: input.readinessLevel ?? 'developing',
      readinessMonths: input.readinessMonths ?? null,
      priority: input.priority ?? 1,
      notes: input.notes ?? null,
      statusCode: input.statusCode ?? 'active',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateSuccessor(
  tenantId: string,
  id: string,
  input: Partial<SuccessorWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrSuccessor.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.positionId !== undefined
        ? { positionId: input.positionId }
        : {}),
      ...(input.employeeId !== undefined
        ? { employeeId: input.employeeId }
        : {}),
      ...(input.readinessLevel !== undefined
        ? { readinessLevel: input.readinessLevel }
        : {}),
      ...(input.readinessMonths !== undefined
        ? { readinessMonths: input.readinessMonths ?? null }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findSuccessorById(tenantId, id, client)
}

export async function softDeleteSuccessor(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrSuccessor.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
  })
  return result.count > 0
}

// --- Promotions -------------------------------------------------------------

export interface PromotionCreateInput {
  employeeId: string
  promotionNumber: string
  fromPositionId?: string | null
  toPositionId?: string | null
  fromJobGradeId?: string | null
  toJobGradeId?: string | null
  oldSalary?: string | number | null
  newSalary?: string | number | null
  effectiveDate?: Date | null
  reason?: string | null
  statusCode?: string
}

export function listPromotions(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrPromotion.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findPromotionById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPromotion.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createPromotion(
  tenantId: string,
  input: PromotionCreateInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrPromotion.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      promotionNumber: input.promotionNumber,
      fromPositionId: input.fromPositionId ?? null,
      toPositionId: input.toPositionId ?? null,
      fromJobGradeId: input.fromJobGradeId ?? null,
      toJobGradeId: input.toJobGradeId ?? null,
      oldSalary: input.oldSalary ?? null,
      newSalary: input.newSalary ?? null,
      effectiveDate: input.effectiveDate ?? null,
      reason: input.reason ?? null,
      statusCode: input.statusCode ?? 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function updatePromotionStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrPromotion.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}
