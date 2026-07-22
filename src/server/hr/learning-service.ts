import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as learningRepo from '#/server/repos/hr-learning-repo'
import type { CurrentUserContext } from '#/types/auth'

// Learning & training service. Manages the training catalog (courses), the
// scheduled delivery of those courses (sessions), employee enrollments
// (records), and the certificates issued on completion. All writes are gated on
// 'hr.training_manage' by the server functions.

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

// --- Courses ----------------------------------------------------------------

export async function listCourses(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await learningRepo.listCourses(tenantId))
}

export async function createCourse(
  context: CurrentUserContext,
  tenantId: string,
  input: learningRepo.TrainingCourseWriteInput,
) {
  const course = await learningRepo.createCourse(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_course',
    course.id,
    {
      code: course.code,
    },
  )
  return serializeRecord(course)
}

export async function updateCourse(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<learningRepo.TrainingCourseWriteInput>,
) {
  const course = await learningRepo.updateCourse(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!course) throw new NotFoundError('Training course not found.')
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_course',
    id,
    null,
  )
  return serializeRecord(course)
}

export async function deleteCourse(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await learningRepo.softDeleteCourse(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Training course not found.')
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_course',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Sessions ---------------------------------------------------------------

export async function listSessions(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { courseId?: string } = {},
) {
  return serializeRecords(await learningRepo.listSessions(tenantId, filters))
}

export async function createSession(
  context: CurrentUserContext,
  tenantId: string,
  input: learningRepo.TrainingSessionCreateInput,
) {
  const course = await learningRepo.findCourseById(tenantId, input.courseId)
  if (!course) throw new ValidationError('Training course not found.')

  const session = await learningRepo.createSession(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_session',
    session.id,
    {
      code: session.code,
    },
  )
  return serializeRecord(session)
}

export async function updateSessionStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  statusCode: string,
) {
  const existing = await learningRepo.findSessionById(tenantId, id)
  if (!existing) throw new NotFoundError('Training session not found.')

  await learningRepo.updateSessionStatus(
    tenantId,
    id,
    statusCode,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_session',
    id,
    { statusCode },
  )
  const updated = await learningRepo.findSessionById(tenantId, id)
  return updated ? serializeRecord(updated) : null
}

// --- Records (enrollments) --------------------------------------------------

export async function listRecords(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { sessionId?: string; employeeId?: string } = {},
) {
  return serializeRecords(await learningRepo.listRecords(tenantId, filters))
}

export async function enroll(
  context: CurrentUserContext,
  tenantId: string,
  input: learningRepo.TrainingRecordCreateInput,
) {
  const session = await learningRepo.findSessionById(tenantId, input.sessionId)
  if (!session) throw new ValidationError('Training session not found.')

  const record = await learningRepo.createRecord(tenantId, input)
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_record',
    record.id,
    {
      sessionId: record.sessionId,
      employeeId: record.employeeId,
    },
  )
  return serializeRecord(record)
}

export async function recordCompletion(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: learningRepo.TrainingRecordCompletionInput,
) {
  const record = await learningRepo.updateRecordCompletion(tenantId, id, input)
  if (!record) throw new NotFoundError('Training record not found.')
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_record',
    id,
    {
      statusCode: record.statusCode,
    },
  )
  return serializeRecord(record)
}

// --- Certificates -----------------------------------------------------------

export async function listCertificates(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string } = {},
) {
  return serializeRecords(
    await learningRepo.listCertificates(tenantId, filters),
  )
}

export async function issueCertificate(
  context: CurrentUserContext,
  tenantId: string,
  input: learningRepo.TrainingCertificateCreateInput,
) {
  const record = await learningRepo.findRecordById(tenantId, input.recordId)
  if (!record) throw new ValidationError('Training record not found.')

  const certificate = await learningRepo.createCertificate(tenantId, input)
  await audit(
    context,
    tenantId,
    'hr.training_manage',
    'hr_training_certificate',
    certificate.id,
    {
      certificateNo: certificate.certificateNo,
    },
  )
  return serializeRecord(certificate)
}
