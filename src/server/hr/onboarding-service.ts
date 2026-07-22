import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as employeeRepo from '#/server/repos/hr-employee-repo'
import * as recruitmentRepo from '#/server/repos/hr-recruitment-repo'
import type { CurrentUserContext } from '#/types/auth'

// Onboarding service. Templates are reusable task checklists; assigning a
// template to an employee materialises one HrEmployeeOnboarding row per template
// task, with due dates offset from a start date. Tasks are completed
// individually. Every write appends an audit entry.

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

function addDays(base: Date, days: number): Date {
  const result = new Date(base)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

// --- Templates --------------------------------------------------------------

export async function listTemplates(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await recruitmentRepo.listTemplates(tenantId))
}

export async function getTemplate(
  _c: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const template = await recruitmentRepo.findTemplateById(tenantId, id)
  if (!template) throw new NotFoundError('Onboarding template not found.')
  const tasks = await recruitmentRepo.listTasksForTemplate(tenantId, id)
  return { ...serializeRecord(template), tasks: serializeRecords(tasks) }
}

export async function createTemplate(
  context: CurrentUserContext,
  tenantId: string,
  input: recruitmentRepo.OnboardingTemplateWriteInput,
) {
  const template = await recruitmentRepo.createTemplate(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_onboarding_template',
    template.id,
    {
      code: template.code,
    },
  )
  return serializeRecord(template)
}

export async function updateTemplate(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<recruitmentRepo.OnboardingTemplateWriteInput>,
) {
  const template = await recruitmentRepo.updateTemplate(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!template) throw new NotFoundError('Onboarding template not found.')
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_onboarding_template',
    id,
    null,
  )
  return serializeRecord(template)
}

export async function deleteTemplate(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await recruitmentRepo.softDeleteTemplate(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Onboarding template not found.')
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_onboarding_template',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Template tasks ---------------------------------------------------------

export async function listTemplateTasks(
  _c: CurrentUserContext,
  tenantId: string,
  templateId: string,
) {
  return serializeRecords(
    await recruitmentRepo.listTasksForTemplate(tenantId, templateId),
  )
}

export async function addTemplateTask(
  context: CurrentUserContext,
  tenantId: string,
  input: recruitmentRepo.OnboardingTaskWriteInput,
) {
  const template = await recruitmentRepo.findTemplateById(
    tenantId,
    input.templateId,
  )
  if (!template) throw new ValidationError('Onboarding template not found.')
  const task = await recruitmentRepo.createTask(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_onboarding_task',
    task.id,
    {
      templateId: input.templateId,
    },
  )
  return serializeRecord(task)
}

// --- Employee onboarding ----------------------------------------------------

export async function listEmployeeOnboarding(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(
    await recruitmentRepo.listEmployeeOnboarding(tenantId, filters),
  )
}

// Materialises an onboarding checklist for an employee from a template. Each
// template task becomes one assignment row with a due date offset from
// `startDate` (defaults to now).
export async function assignTemplate(
  context: CurrentUserContext,
  tenantId: string,
  input: { employeeId: string; templateId: string; startDate?: Date | null },
) {
  const employee = await employeeRepo.findEmployeeSummaryById(
    tenantId,
    input.employeeId,
  )
  if (!employee) throw new ValidationError('Employee not found.')
  const template = await recruitmentRepo.findTemplateById(
    tenantId,
    input.templateId,
  )
  if (!template) throw new ValidationError('Onboarding template not found.')

  const tasks = await recruitmentRepo.listTasksForTemplate(
    tenantId,
    input.templateId,
  )
  if (tasks.length === 0) {
    throw new ConflictError('This template has no tasks to assign.')
  }
  const start = input.startDate ?? new Date()

  const created = await prisma.$transaction(async (tx) => {
    const rows: Array<
      Awaited<ReturnType<typeof recruitmentRepo.createEmployeeOnboarding>>
    > = []
    for (const task of tasks) {
      const row = await recruitmentRepo.createEmployeeOnboarding(
        tenantId,
        {
          employeeId: input.employeeId,
          templateId: input.templateId,
          taskId: task.id,
          title: task.title,
          category: task.category,
          dueDate: addDays(start, task.dueOffsetDays),
          statusCode: 'pending',
        },
        context.profileId,
        tx,
      )
      rows.push(row)
    }
    return rows
  })

  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_employee_onboarding',
    input.employeeId,
    {
      templateId: input.templateId,
      taskCount: created.length,
    },
  )
  return serializeRecords(created)
}

export async function completeOnboardingTask(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const existing = await recruitmentRepo.findEmployeeOnboardingById(
    tenantId,
    id,
  )
  if (!existing) throw new NotFoundError('Onboarding task not found.')
  if (existing.statusCode === 'completed') {
    throw new ConflictError('This onboarding task is already completed.')
  }
  await recruitmentRepo.updateEmployeeOnboardingStatus(
    tenantId,
    id,
    'completed',
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_employee_onboarding',
    id,
    {
      statusCode: 'completed',
    },
  )
  const updated = await recruitmentRepo.findEmployeeOnboardingById(tenantId, id)
  return updated ? serializeRecord(updated) : null
}

export async function setOnboardingTaskStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  statusCode: string,
) {
  const existing = await recruitmentRepo.findEmployeeOnboardingById(
    tenantId,
    id,
  )
  if (!existing) throw new NotFoundError('Onboarding task not found.')
  await recruitmentRepo.updateEmployeeOnboardingStatus(
    tenantId,
    id,
    statusCode,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_employee_onboarding',
    id,
    { statusCode },
  )
  const updated = await recruitmentRepo.findEmployeeOnboardingById(tenantId, id)
  return updated ? serializeRecord(updated) : null
}
