import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as workforceRepo from '#/server/repos/hr-workforce-repo'
import type { CurrentUserContext } from '#/types/auth'

// Workforce planning service: skills catalog, per-employee skill assessments,
// workforce plans with headcount targets, and their position/skill
// requirements. Writes are audited; reads serialize Decimal columns to strings.

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

// --- Skills catalog ---------------------------------------------------------

export async function listSkills(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await workforceRepo.listSkills(tenantId))
}

export async function createSkill(
  context: CurrentUserContext,
  tenantId: string,
  input: workforceRepo.SkillWriteInput,
) {
  const skill = await workforceRepo.createSkill(
    tenantId,
    input,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.org_manage', 'hr_skill', skill.id, {
    code: skill.code,
  })
  return serializeRecord(skill)
}

export async function updateSkill(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<workforceRepo.SkillWriteInput>,
) {
  const skill = await workforceRepo.updateSkill(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!skill) throw new NotFoundError('Skill not found.')
  await audit(context, tenantId, 'hr.org_manage', 'hr_skill', id, null)
  return serializeRecord(skill)
}

export async function deleteSkill(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await workforceRepo.softDeleteSkill(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Skill not found.')
  await audit(context, tenantId, 'hr.org_manage', 'hr_skill', id, null)
  return { id, deleted: true }
}

// --- Employee skills --------------------------------------------------------

export async function listEmployeeSkills(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; skillId?: string } = {},
) {
  return serializeRecords(
    await workforceRepo.listEmployeeSkills(tenantId, filters),
  )
}

export async function upsertEmployeeSkill(
  context: CurrentUserContext,
  tenantId: string,
  input: workforceRepo.EmployeeSkillUpsertInput,
) {
  const record = await workforceRepo.upsertEmployeeSkill(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.org_manage',
    'hr_employee_skill',
    record.id,
    null,
  )
  return serializeRecord(record)
}

export async function deleteEmployeeSkill(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await workforceRepo.deleteEmployeeSkill(tenantId, id)
  if (!deleted) throw new NotFoundError('Employee skill not found.')
  await audit(context, tenantId, 'hr.org_manage', 'hr_employee_skill', id, null)
  return { id, deleted: true }
}

// --- Workforce plans --------------------------------------------------------

export async function listPlans(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { fiscalYear?: number } = {},
) {
  return serializeRecords(await workforceRepo.listPlans(tenantId, filters))
}

export async function createPlan(
  context: CurrentUserContext,
  tenantId: string,
  input: workforceRepo.WorkforcePlanWriteInput,
) {
  const plan = await workforceRepo.createPlan(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.org_manage',
    'hr_workforce_plan',
    plan.id,
    { code: plan.code },
  )
  return serializeRecord(plan)
}

export async function updatePlan(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<workforceRepo.WorkforcePlanWriteInput>,
) {
  const plan = await workforceRepo.updatePlan(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!plan) throw new NotFoundError('Workforce plan not found.')
  await audit(context, tenantId, 'hr.org_manage', 'hr_workforce_plan', id, null)
  return serializeRecord(plan)
}

export async function deletePlan(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await workforceRepo.softDeletePlan(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Workforce plan not found.')
  await audit(context, tenantId, 'hr.org_manage', 'hr_workforce_plan', id, null)
  return { id, deleted: true }
}

// --- Workforce requirements -------------------------------------------------

export async function listRequirements(
  _c: CurrentUserContext,
  tenantId: string,
  planId: string,
) {
  return serializeRecords(
    await workforceRepo.listRequirementsForPlan(tenantId, planId),
  )
}

export async function addRequirement(
  context: CurrentUserContext,
  tenantId: string,
  input: workforceRepo.WorkforceRequirementCreateInput,
) {
  const plan = await workforceRepo.findPlanById(tenantId, input.planId)
  if (!plan) throw new ValidationError('Workforce plan not found.')
  const requirement = await workforceRepo.createRequirement(tenantId, input)
  await audit(
    context,
    tenantId,
    'hr.org_manage',
    'hr_workforce_requirement',
    requirement.id,
    null,
  )
  return serializeRecord(requirement)
}

// --- Skill requirements -----------------------------------------------------

export async function listSkillRequirements(
  _c: CurrentUserContext,
  tenantId: string,
  positionId: string,
) {
  return serializeRecords(
    await workforceRepo.listSkillRequirementsForPosition(tenantId, positionId),
  )
}

export async function addSkillRequirement(
  context: CurrentUserContext,
  tenantId: string,
  input: workforceRepo.SkillRequirementCreateInput,
) {
  const requirement = await workforceRepo.createSkillRequirement(
    tenantId,
    input,
  )
  await audit(
    context,
    tenantId,
    'hr.org_manage',
    'hr_skill_requirement',
    requirement.id,
    null,
  )
  return serializeRecord(requirement)
}
