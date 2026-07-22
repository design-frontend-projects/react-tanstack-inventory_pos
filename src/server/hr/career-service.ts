import { randomUUID } from 'node:crypto'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as careerRepo from '#/server/repos/hr-career-repo'
import * as employeeRepo from '#/server/repos/hr-employee-repo'
import type { CurrentUserContext } from '#/types/auth'

// Career & succession service. Career paths and succession candidates are plain
// configuration. A promotion is a draft-then-approve document: approving it
// moves the employee onto the target position/grade and records the change in
// the employee's history — all inside one transaction (BR-PROMOTION).

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

// --- Career paths -----------------------------------------------------------

export async function listCareerPaths(
  _c: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await careerRepo.listCareerPaths(tenantId))
}

export async function createCareerPath(
  context: CurrentUserContext,
  tenantId: string,
  input: careerRepo.CareerPathWriteInput,
) {
  const path = await careerRepo.createCareerPath(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.employee_manage',
    'hr_career_path',
    path.id,
    {
      code: path.code,
    },
  )
  return serializeRecord(path)
}

export async function updateCareerPath(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<careerRepo.CareerPathWriteInput>,
) {
  const path = await careerRepo.updateCareerPath(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!path) throw new NotFoundError('Career path not found.')
  await audit(
    context,
    tenantId,
    'hr.employee_manage',
    'hr_career_path',
    id,
    null,
  )
  return serializeRecord(path)
}

export async function deleteCareerPath(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await careerRepo.softDeleteCareerPath(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Career path not found.')
  await audit(
    context,
    tenantId,
    'hr.employee_manage',
    'hr_career_path',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Successors -------------------------------------------------------------

export async function listSuccessors(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { positionId?: string; employeeId?: string } = {},
) {
  return serializeRecords(await careerRepo.listSuccessors(tenantId, filters))
}

export async function createSuccessor(
  context: CurrentUserContext,
  tenantId: string,
  input: careerRepo.SuccessorWriteInput,
) {
  const successor = await careerRepo.createSuccessor(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.employee_manage',
    'hr_successor',
    successor.id,
    {
      positionId: successor.positionId,
      employeeId: successor.employeeId,
    },
  )
  return serializeRecord(successor)
}

export async function updateSuccessor(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<careerRepo.SuccessorWriteInput>,
) {
  const successor = await careerRepo.updateSuccessor(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!successor) throw new NotFoundError('Successor not found.')
  await audit(context, tenantId, 'hr.employee_manage', 'hr_successor', id, null)
  return serializeRecord(successor)
}

export async function deleteSuccessor(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await careerRepo.softDeleteSuccessor(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Successor not found.')
  await audit(context, tenantId, 'hr.employee_manage', 'hr_successor', id, null)
  return { id, deleted: true }
}

// --- Promotions -------------------------------------------------------------

export async function listPromotions(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await careerRepo.listPromotions(tenantId, filters))
}

export interface PromotionInput {
  employeeId: string
  toPositionId?: string | null
  toJobGradeId?: string | null
  newSalary?: string | number | null
  effectiveDate?: Date | null
  reason?: string | null
}

export async function createPromotion(
  context: CurrentUserContext,
  tenantId: string,
  input: PromotionInput,
) {
  const employee = await employeeRepo.findEmployeeSummaryById(
    tenantId,
    input.employeeId,
  )
  if (!employee) throw new ValidationError('Employee not found.')

  const promotionNumber = `PRM-${randomUUID().slice(0, 8).toUpperCase()}`

  const promotion = await careerRepo.createPromotion(
    tenantId,
    {
      employeeId: input.employeeId,
      promotionNumber,
      fromPositionId: employee.positionId,
      toPositionId: input.toPositionId ?? null,
      fromJobGradeId: employee.jobGradeId,
      toJobGradeId: input.toJobGradeId ?? null,
      newSalary: input.newSalary ?? null,
      effectiveDate: input.effectiveDate ?? null,
      reason: input.reason ?? null,
      statusCode: 'draft',
    },
    context.profileId,
  )

  await audit(
    context,
    tenantId,
    'hr.employee_manage',
    'hr_promotion',
    promotion.id,
    {
      promotionNumber,
    },
  )
  return serializeRecord(promotion)
}

export async function approvePromotion(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const existing = await careerRepo.findPromotionById(tenantId, id)
  if (!existing) throw new NotFoundError('Promotion not found.')
  if (existing.statusCode !== 'draft' && existing.statusCode !== 'submitted') {
    throw new ConflictError(
      'Only a draft or submitted promotion can be approved.',
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    await careerRepo.updatePromotionStatus(
      tenantId,
      id,
      'approved',
      context.profileId,
      tx,
    )

    // Move the employee onto the target position/grade and record the change.
    await employeeRepo.updateEmployee(
      tenantId,
      existing.employeeId,
      {
        ...(existing.toPositionId ? { positionId: existing.toPositionId } : {}),
        ...(existing.toJobGradeId ? { jobGradeId: existing.toJobGradeId } : {}),
      },
      context.profileId,
      tx,
    )

    await employeeRepo.appendEmployeeHistory(
      tenantId,
      {
        employeeId: existing.employeeId,
        changeType: 'promotion',
        fieldName: 'positionId',
        oldValue: existing.fromPositionId ?? null,
        newValue: existing.toPositionId ?? null,
        effectiveDate: existing.effectiveDate ?? new Date(),
        reason: existing.reason ?? null,
        reference: existing.promotionNumber,
      },
      context.profileId,
      tx,
    )

    return careerRepo.findPromotionById(tenantId, id, tx)
  })

  await audit(context, tenantId, 'hr.employee_manage', 'hr_promotion', id, {
    statusCode: 'approved',
  })
  return updated ? serializeRecord(updated) : null
}
