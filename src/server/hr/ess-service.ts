import { randomUUID } from 'node:crypto'
import { NotFoundError } from '#/server/auth/errors'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as essRepo from '#/server/repos/hr-ess-repo'
import type { CurrentUserContext } from '#/types/auth'

// Employee Self-Service (ESS) service: employee-raised requests (HR tickets)
// and the company announcements feed. Request numbers use a short plain code
// (no new DocumentType). Writes are audited.

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string,
  newValues?: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: newValues ?? null,
  })
}

function nextRequestNumber(): string {
  return `REQ-${randomUUID().slice(0, 8).toUpperCase()}`
}

// --- Employee requests ------------------------------------------------------

export async function listRequests(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await essRepo.listEmployeeRequests(tenantId, filters))
}

export async function getRequest(
  _c: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const request = await essRepo.findEmployeeRequestById(tenantId, id)
  if (!request) throw new NotFoundError('Employee request not found.')
  return serializeRecord(request)
}

export interface EmployeeRequestInput {
  employeeId: string
  requestType: string
  subject: string
  details?: string | null
  priority?: string
}

export async function submitRequest(
  context: CurrentUserContext,
  tenantId: string,
  input: EmployeeRequestInput,
) {
  const request = await essRepo.createEmployeeRequest(
    tenantId,
    {
      employeeId: input.employeeId,
      requestNumber: nextRequestNumber(),
      requestType: input.requestType,
      subject: input.subject,
      details: input.details ?? null,
      priority: input.priority ?? 'normal',
      statusCode: 'open',
    },
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.employee_view',
    'hr_employee_request',
    request.id,
    {
      requestNumber: request.requestNumber,
      requestType: request.requestType,
    },
  )
  return serializeRecord(request)
}

export async function setRequestStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  statusCode: string,
) {
  const request = await essRepo.updateEmployeeRequestStatus(
    tenantId,
    id,
    statusCode,
    context.profileId,
  )
  if (!request) throw new NotFoundError('Employee request not found.')
  await audit(
    context,
    tenantId,
    'hr.employee_view',
    'hr_employee_request',
    id,
    { statusCode },
  )
  return serializeRecord(request)
}

// --- Announcements ----------------------------------------------------------

export async function listAnnouncements(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { statusCode?: string } = {},
) {
  return serializeRecords(await essRepo.listAnnouncements(tenantId, filters))
}

export interface AnnouncementInput {
  title: string
  body?: string | null
  category?: string
  audience?: string
  departmentId?: string | null
  isPinned?: boolean
}

export async function createAnnouncement(
  context: CurrentUserContext,
  tenantId: string,
  input: AnnouncementInput,
) {
  const announcement = await essRepo.createAnnouncement(
    tenantId,
    {
      title: input.title,
      body: input.body ?? null,
      category: input.category ?? 'general',
      audience: input.audience ?? 'all',
      departmentId: input.departmentId ?? null,
      isPinned: input.isPinned ?? false,
      statusCode: 'draft',
    },
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.employee_view',
    'hr_employee_announcement',
    announcement.id,
    {
      title: announcement.title,
    },
  )
  return serializeRecord(announcement)
}

export async function setAnnouncementStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  statusCode: string,
) {
  const announcement = await essRepo.updateAnnouncementStatus(
    tenantId,
    id,
    statusCode,
    context.profileId,
  )
  if (!announcement) throw new NotFoundError('Announcement not found.')
  await audit(
    context,
    tenantId,
    'hr.employee_view',
    'hr_employee_announcement',
    id,
    { statusCode },
  )
  return serializeRecord(announcement)
}
