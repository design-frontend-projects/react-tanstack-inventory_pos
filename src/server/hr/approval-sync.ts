import type { PrismaClientLike } from '#/server/db/types'

// HR document-status sync for the polymorphic approval engine. The engine calls
// `syncHrDocumentStatus` when an approval request for an hr_* entity is approved
// or rejected, and this maps the outcome onto the owning document's status_code.
// Kept in the HR module (not the purchasing approval-engine) so the engine stays
// decoupled from HR internals — it just delegates by entity_type.

// Entity types whose approval routes through the generic pod_approval engine.
export const HR_APPROVAL_ENTITY_TYPES = [
  'hr_loan',
  'hr_salary_advance',
  'hr_payroll_run',
  'hr_expense_claim',
  'hr_travel_request',
  'hr_promotion',
  'hr_job_offer',
  'hr_job_opening',
  'hr_overtime_request',
  'hr_timesheet',
  'hr_workforce_plan',
  'hr_budget_year',
] as const

export type HrApprovalEntityType = (typeof HR_APPROVAL_ENTITY_TYPES)[number]

export function isHrApprovalEntity(entityType: string): boolean {
  return (HR_APPROVAL_ENTITY_TYPES as ReadonlyArray<string>).includes(
    entityType,
  )
}

// Maps each HR entity type to the status_code it takes on approve. Rejection
// always maps to 'rejected'. A few documents move to a domain-specific "active"
// state on approval rather than a bare 'approved'.
const APPROVED_STATUS: Record<HrApprovalEntityType, string> = {
  hr_loan: 'approved',
  hr_salary_advance: 'approved',
  hr_payroll_run: 'approved',
  hr_expense_claim: 'approved',
  hr_travel_request: 'approved',
  hr_promotion: 'approved',
  hr_job_offer: 'approved',
  hr_job_opening: 'open',
  hr_overtime_request: 'approved',
  hr_timesheet: 'approved',
  hr_workforce_plan: 'approved',
  hr_budget_year: 'approved',
}

// Resolves the tenant-scoped Prisma model delegate for an entity type. Every HR
// document carries a string status_code column updated the same way.
function updateStatus(
  tx: PrismaClientLike,
  entityType: HrApprovalEntityType,
  tenantId: string,
  entityId: string,
  statusCode: string,
  actorProfileId: string,
) {
  const where = { id: entityId, tenantId }
  const data = { statusCode, updatedBy: actorProfileId }

  switch (entityType) {
    case 'hr_loan':
      return tx.hrLoan.updateMany({ where, data })
    case 'hr_salary_advance':
      return tx.hrSalaryAdvance.updateMany({ where, data })
    case 'hr_payroll_run':
      return tx.hrPayrollRun.updateMany({ where, data })
    case 'hr_expense_claim':
      return tx.hrExpenseClaim.updateMany({ where, data })
    case 'hr_travel_request':
      return tx.hrTravelRequest.updateMany({ where, data })
    case 'hr_promotion':
      return tx.hrPromotion.updateMany({ where, data })
    case 'hr_job_offer':
      return tx.hrJobOffer.updateMany({ where, data })
    case 'hr_job_opening':
      return tx.hrJobOpening.updateMany({ where, data })
    case 'hr_overtime_request':
      return tx.hrOvertimeRequest.updateMany({ where, data })
    case 'hr_timesheet':
      return tx.hrTimesheet.updateMany({ where, data })
    case 'hr_workforce_plan':
      return tx.hrWorkforcePlan.updateMany({ where, data })
    case 'hr_budget_year':
      return tx.hrBudgetYear.updateMany({ where, data })
    default:
      return Promise.resolve()
  }
}

export async function syncHrDocumentStatus(
  tenantId: string,
  entityType: string,
  entityId: string,
  outcome: 'approved' | 'rejected',
  actorProfileId: string,
  tx: PrismaClientLike,
): Promise<void> {
  if (!isHrApprovalEntity(entityType)) {
    return
  }

  const typed = entityType as HrApprovalEntityType
  const statusCode =
    outcome === 'approved' ? APPROVED_STATUS[typed] : 'rejected'
  await updateStatus(tx, typed, tenantId, entityId, statusCode, actorProfileId)
}
