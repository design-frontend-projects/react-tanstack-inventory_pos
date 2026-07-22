import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for Employee Self-Service: employee-raised requests
// (HR tickets) and the company announcements feed. All reads filter by
// tenantId.

// --- Employee requests ------------------------------------------------------

export interface EmployeeRequestCreateInput {
  employeeId: string
  requestNumber: string
  requestType: string
  subject: string
  details?: string | null
  priority?: string
  statusCode?: string
}

export function listEmployeeRequests(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeRequest.findMany({
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

export function findEmployeeRequestById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeRequest.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createEmployeeRequest(
  tenantId: string,
  input: EmployeeRequestCreateInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeRequest.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      requestNumber: input.requestNumber,
      requestType: input.requestType,
      subject: input.subject.trim(),
      details: input.details?.trim() ?? null,
      priority: input.priority ?? 'normal',
      statusCode: input.statusCode ?? 'open',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateEmployeeRequestStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrEmployeeRequest.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      resolvedAt: ['resolved', 'closed', 'rejected'].includes(statusCode)
        ? new Date()
        : null,
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findEmployeeRequestById(tenantId, id, client)
}

// --- Announcements ----------------------------------------------------------

export interface AnnouncementCreateInput {
  title: string
  body?: string | null
  category?: string
  audience?: string
  departmentId?: string | null
  publishAt?: Date | null
  expiresAt?: Date | null
  isPinned?: boolean
  statusCode?: string
}

export function listAnnouncements(
  tenantId: string,
  filters: { statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeAnnouncement.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  })
}

export function findAnnouncementById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeAnnouncement.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createAnnouncement(
  tenantId: string,
  input: AnnouncementCreateInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeAnnouncement.create({
    data: {
      tenantId,
      title: input.title.trim(),
      body: input.body?.trim() ?? null,
      category: input.category ?? 'general',
      audience: input.audience ?? 'all',
      departmentId: input.departmentId ?? null,
      publishAt: input.publishAt ?? null,
      expiresAt: input.expiresAt ?? null,
      isPinned: input.isPinned ?? false,
      statusCode: input.statusCode ?? 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateAnnouncementStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrEmployeeAnnouncement.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      ...(statusCode === 'published' ? { publishAt: new Date() } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findAnnouncementById(tenantId, id, client)
}
