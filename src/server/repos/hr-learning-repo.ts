import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for the learning & training sub-domain: courses,
// scheduled sessions, per-employee training records, and issued certificates.
// All reads filter by tenantId; records and certificates are the auditable
// trail of who attended what.

// --- Training courses -------------------------------------------------------

export interface TrainingCourseWriteInput {
  code: string
  name: string
  nameAr?: string | null
  category?: string
  deliveryMode?: string
  provider?: string | null
  durationHours?: string | number | null
  cost?: string | number | null
  currencyCode?: string
  description?: string | null
  statusCode?: string
  isActive?: boolean
}

export function listCourses(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingCourse.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { name: 'asc' },
    take: 300,
  })
}

export function findCourseById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingCourse.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createCourse(
  tenantId: string,
  input: TrainingCourseWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingCourse.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      category: input.category ?? 'general',
      deliveryMode: input.deliveryMode ?? 'classroom',
      provider: input.provider ?? null,
      durationHours: input.durationHours ?? null,
      cost: input.cost ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      description: input.description ?? null,
      statusCode: input.statusCode ?? 'active',
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateCourse(
  tenantId: string,
  id: string,
  input: Partial<TrainingCourseWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrTrainingCourse.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.deliveryMode !== undefined
        ? { deliveryMode: input.deliveryMode }
        : {}),
      ...(input.provider !== undefined
        ? { provider: input.provider ?? null }
        : {}),
      ...(input.durationHours !== undefined
        ? { durationHours: input.durationHours ?? null }
        : {}),
      ...(input.cost !== undefined ? { cost: input.cost ?? null } : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description ?? null }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findCourseById(tenantId, id, client)
}

export async function softDeleteCourse(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrTrainingCourse.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, updatedBy: actorId },
  })
  return result.count > 0
}

// --- Training sessions ------------------------------------------------------

export interface TrainingSessionCreateInput {
  courseId: string
  code: string
  trainerId?: string | null
  trainerName?: string | null
  location?: string | null
  startDate?: Date | null
  endDate?: Date | null
  capacity?: number | null
  statusCode?: string
}

export function listSessions(
  tenantId: string,
  filters: { courseId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingSession.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
    },
    orderBy: { startDate: 'desc' },
    take: 300,
  })
}

export function findSessionById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingSession.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createSession(
  tenantId: string,
  input: TrainingSessionCreateInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingSession.create({
    data: {
      tenantId,
      courseId: input.courseId,
      code: input.code.trim(),
      trainerId: input.trainerId ?? null,
      trainerName: input.trainerName?.trim() ?? null,
      location: input.location?.trim() ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      capacity: input.capacity ?? null,
      statusCode: input.statusCode ?? 'scheduled',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function updateSessionStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingSession.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}

// --- Training records (enrollments) -----------------------------------------

export interface TrainingRecordCreateInput {
  sessionId: string
  employeeId: string
  statusCode?: string
}

export interface TrainingRecordCompletionInput {
  attendancePct?: string | number | null
  score?: string | number | null
  completedAt?: Date | null
  statusCode?: string
  feedback?: string | null
}

export function listRecords(
  tenantId: string,
  filters: { sessionId?: string; employeeId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingRecord.findMany({
    where: {
      tenantId,
      ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}

export function findRecordById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingRecord.findFirst({
    where: { id, tenantId },
  })
}

export function createRecord(
  tenantId: string,
  input: TrainingRecordCreateInput,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingRecord.create({
    data: {
      tenantId,
      sessionId: input.sessionId,
      employeeId: input.employeeId,
      enrolledAt: new Date(),
      statusCode: input.statusCode ?? 'enrolled',
    },
  })
}

export async function updateRecordCompletion(
  tenantId: string,
  id: string,
  input: TrainingRecordCompletionInput,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrTrainingRecord.updateMany({
    where: { id, tenantId },
    data: {
      ...(input.attendancePct !== undefined
        ? { attendancePct: input.attendancePct ?? null }
        : {}),
      ...(input.score !== undefined ? { score: input.score ?? null } : {}),
      ...(input.completedAt !== undefined
        ? { completedAt: input.completedAt ?? null }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      ...(input.feedback !== undefined
        ? { feedback: input.feedback ?? null }
        : {}),
    },
  })
  if (result.count === 0) return null
  return findRecordById(tenantId, id, client)
}

// --- Training certificates --------------------------------------------------

export interface TrainingCertificateCreateInput {
  recordId: string
  employeeId: string
  certificateNo: string
  issuedAt?: Date | null
  expiryDate?: Date | null
  fileUrl?: string | null
}

export function listCertificates(
  tenantId: string,
  filters: { employeeId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingCertificate.findMany({
    where: {
      tenantId,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}

export function createCertificate(
  tenantId: string,
  input: TrainingCertificateCreateInput,
  client: PrismaClientLike = prisma,
) {
  return client.hrTrainingCertificate.create({
    data: {
      tenantId,
      recordId: input.recordId,
      employeeId: input.employeeId,
      certificateNo: input.certificateNo.trim(),
      issuedAt: input.issuedAt ?? new Date(),
      expiryDate: input.expiryDate ?? null,
      fileUrl: input.fileUrl ?? null,
    },
  })
}
