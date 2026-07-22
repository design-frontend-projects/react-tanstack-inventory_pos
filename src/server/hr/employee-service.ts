import { NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { computeHistoryEntries } from '#/server/hr/employee-history'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as employeeRepo from '#/server/repos/hr-employee-repo'
import type { CurrentUserContext } from '#/types/auth'

// Employee master service. The core invariant (BR-EMP-1): an employee's history
// is never overwritten — every mutation appends HrEmployeeHistory rows in the
// same transaction as the update, so the employment timeline is always complete
// and auditable. The change-detection is a pure helper (employee-history.ts).

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityId: string | null,
  newValues?: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType: 'hr_employee',
    entityId,
    newValues: newValues ?? null,
  })
}

export interface EmployeeListFilters extends employeeRepo.EmployeeListFilters {}

export async function listEmployees(
  _context: CurrentUserContext,
  tenantId: string,
  filters: EmployeeListFilters = {},
) {
  const [items, total] = await Promise.all([
    employeeRepo.listEmployees(tenantId, filters),
    employeeRepo.countEmployees(tenantId, filters),
  ])

  return { items: serializeRecords(items), total }
}

export async function getEmployee(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const employee = await employeeRepo.findEmployeeById(tenantId, id)
  if (!employee) {
    throw new NotFoundError('Employee not found.')
  }

  // Serialize the root + each sub-collection (Decimal → string).
  return {
    ...serializeRecord(employee),
    contacts: serializeRecords(employee.contacts),
    addresses: serializeRecords(employee.addresses),
    documents: serializeRecords(employee.documents),
    bankAccounts: serializeRecords(employee.bankAccounts),
    contracts: serializeRecords(employee.contracts),
    history: serializeRecords(employee.history),
    dependents: serializeRecords(employee.dependents),
    education: serializeRecords(employee.education),
    experience: serializeRecords(employee.experience),
    certifications: serializeRecords(employee.certifications),
    languages: serializeRecords(employee.languages),
  }
}

export async function createEmployee(
  context: CurrentUserContext,
  tenantId: string,
  input: employeeRepo.EmployeeWriteInput,
) {
  const employee = await prisma.$transaction(async (tx) => {
    const created = await employeeRepo.createEmployee(
      tenantId,
      input,
      context.profileId,
      tx,
    )
    await employeeRepo.appendEmployeeHistory(
      tenantId,
      {
        employeeId: created.id,
        changeType: 'hired',
        newValue: created.employeeCode,
        effectiveDate: created.hireDate ?? new Date(),
        reason: 'Employee record created',
      },
      context.profileId,
      tx,
    )
    return created
  })

  await audit(context, tenantId, 'hr.employee_manage', employee.id, {
    employeeCode: employee.employeeCode,
  })

  return serializeRecord(employee)
}

export async function updateEmployee(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<employeeRepo.EmployeeWriteInput>,
) {
  const existing = await employeeRepo.findEmployeeSummaryById(tenantId, id)
  if (!existing) {
    throw new NotFoundError('Employee not found.')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await employeeRepo.updateEmployee(
      tenantId,
      id,
      input,
      context.profileId,
      tx,
    )
    if (!result) {
      throw new NotFoundError('Employee not found.')
    }

    // Append a history row for each tracked field that actually changed.
    const entries = computeHistoryEntries(
      existing as Record<string, unknown>,
      input as Record<string, unknown>,
    )
    for (const entry of entries) {
      await employeeRepo.appendEmployeeHistory(
        tenantId,
        { employeeId: id, ...entry },
        context.profileId,
        tx,
      )
    }

    return result
  })

  await audit(context, tenantId, 'hr.employee_manage', id, null)

  return serializeRecord(updated)
}

export async function deleteEmployee(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  reason?: string,
) {
  const existing = await employeeRepo.findEmployeeSummaryById(tenantId, id)
  if (!existing) {
    throw new NotFoundError('Employee not found.')
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await employeeRepo.softDeleteEmployee(
      tenantId,
      id,
      context.profileId,
      tx,
    )
    if (!deleted) {
      throw new NotFoundError('Employee not found.')
    }

    await employeeRepo.appendEmployeeHistory(
      tenantId,
      {
        employeeId: id,
        changeType: 'terminated',
        reason: reason ?? 'Employee record archived',
      },
      context.profileId,
      tx,
    )
  })

  await audit(context, tenantId, 'hr.employee_manage', id, null)

  return { id, deleted: true }
}

export async function getEmployeeHistory(
  _context: CurrentUserContext,
  tenantId: string,
  employeeId: string,
) {
  return serializeRecords(
    await employeeRepo.listEmployeeHistory(tenantId, employeeId),
  )
}
