import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as budgetRepo from '#/server/repos/hr-budget-repo'
import type { CurrentUserContext } from '#/types/auth'

// HR budgeting service: budget years, per-department and per-position
// allocations, and the monthly budget-vs-actual ledger. Writes are audited;
// reads serialize Decimal columns to strings.

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

// --- Budget years -----------------------------------------------------------

export async function listBudgetYears(
  _c: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await budgetRepo.listBudgetYears(tenantId))
}

export async function createBudgetYear(
  context: CurrentUserContext,
  tenantId: string,
  input: budgetRepo.BudgetYearWriteInput,
) {
  const year = await budgetRepo.createBudgetYear(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_budget_year',
    year.id,
    {
      fiscalYear: year.fiscalYear,
    },
  )
  return serializeRecord(year)
}

export async function updateBudgetYear(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<budgetRepo.BudgetYearWriteInput>,
) {
  const year = await budgetRepo.updateBudgetYear(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!year) throw new NotFoundError('Budget year not found.')
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_budget_year',
    id,
    null,
  )
  return serializeRecord(year)
}

export async function deleteBudgetYear(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await budgetRepo.softDeleteBudgetYear(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Budget year not found.')
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_budget_year',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Budget departments -----------------------------------------------------

export async function listBudgetDepartments(
  _c: CurrentUserContext,
  tenantId: string,
  budgetYearId: string,
) {
  return serializeRecords(
    await budgetRepo.listBudgetDepartmentsForYear(tenantId, budgetYearId),
  )
}

export async function addBudgetDepartment(
  context: CurrentUserContext,
  tenantId: string,
  input: budgetRepo.BudgetDepartmentCreateInput,
) {
  const year = await budgetRepo.findBudgetYearById(tenantId, input.budgetYearId)
  if (!year) throw new ValidationError('Budget year not found.')
  const record = await budgetRepo.createBudgetDepartment(tenantId, input)
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_budget_department',
    record.id,
    null,
  )
  return serializeRecord(record)
}

// --- Budget positions -------------------------------------------------------

export async function listBudgetPositions(
  _c: CurrentUserContext,
  tenantId: string,
  budgetYearId: string,
) {
  return serializeRecords(
    await budgetRepo.listBudgetPositionsForYear(tenantId, budgetYearId),
  )
}

export async function addBudgetPosition(
  context: CurrentUserContext,
  tenantId: string,
  input: budgetRepo.BudgetPositionCreateInput,
) {
  const year = await budgetRepo.findBudgetYearById(tenantId, input.budgetYearId)
  if (!year) throw new ValidationError('Budget year not found.')
  const record = await budgetRepo.createBudgetPosition(tenantId, input)
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_budget_position',
    record.id,
    null,
  )
  return serializeRecord(record)
}

// --- Budget actuals & variance ----------------------------------------------

export async function listBudgetActuals(
  _c: CurrentUserContext,
  tenantId: string,
  budgetYearId: string,
) {
  return serializeRecords(
    await budgetRepo.listBudgetActualsForYear(tenantId, budgetYearId),
  )
}

export async function addBudgetActual(
  context: CurrentUserContext,
  tenantId: string,
  input: budgetRepo.BudgetActualCreateInput,
) {
  const year = await budgetRepo.findBudgetYearById(tenantId, input.budgetYearId)
  if (!year) throw new ValidationError('Budget year not found.')
  const record = await budgetRepo.createBudgetActual(tenantId, input)
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_budget_actual',
    record.id,
    null,
  )
  return serializeRecord(record)
}

export async function getVariance(
  _c: CurrentUserContext,
  tenantId: string,
  budgetYearId: string,
) {
  return budgetRepo.budgetVariance(tenantId, budgetYearId)
}
