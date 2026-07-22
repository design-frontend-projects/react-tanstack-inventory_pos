import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { availableBalance, computeLeaveDays } from '#/server/hr/leave-calc'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { notify } from '#/server/notifications/notification-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as employeeRepo from '#/server/repos/hr-employee-repo'
import * as leaveRepo from '#/server/repos/hr-leave-repo'
import type { CurrentUserContext } from '#/types/auth'

// Leave service. Self-contained approval: a request holds days in the balance's
// pending bucket on submit, then moves them to used on approval or releases them
// on rejection — all inside one transaction so a balance is never left skewed
// (BR-LEAVE). Notifications are best-effort to the employee / their manager.

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

// --- Leave types (config) ---------------------------------------------------

export async function listLeaveTypes(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await leaveRepo.listLeaveTypes(tenantId))
}

export async function createLeaveType(
  context: CurrentUserContext,
  tenantId: string,
  input: leaveRepo.LeaveTypeWriteInput,
) {
  const type = await leaveRepo.createLeaveType(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_leave_type',
    type.id,
    { code: type.code },
  )
  return serializeRecord(type)
}

export async function updateLeaveType(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<leaveRepo.LeaveTypeWriteInput>,
) {
  const type = await leaveRepo.updateLeaveType(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!type) throw new NotFoundError('Leave type not found.')
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_leave_type',
    id,
    null,
  )
  return serializeRecord(type)
}

export async function deleteLeaveType(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await leaveRepo.softDeleteLeaveType(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Leave type not found.')
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_leave_type',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Balances ---------------------------------------------------------------

export async function listBalances(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; year?: number } = {},
) {
  return serializeRecords(await leaveRepo.listBalances(tenantId, filters))
}

export async function grantBalance(
  context: CurrentUserContext,
  tenantId: string,
  input: leaveRepo.BalanceUpsertInput,
) {
  const balance = await leaveRepo.upsertBalance(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_leave_balance',
    balance.id,
    null,
  )
  return serializeRecord(balance)
}

// --- Requests ---------------------------------------------------------------

export async function listRequests(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await leaveRepo.listRequests(tenantId, filters))
}

export async function getRequest(
  _c: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const request = await leaveRepo.findRequestById(tenantId, id)
  if (!request) throw new NotFoundError('Leave request not found.')
  return {
    ...serializeRecord(request),
    approvals: serializeRecords(request.approvals),
  }
}

export interface LeaveRequestInput {
  employeeId: string
  leaveTypeId: string
  startDate: Date
  endDate: Date
  isHalfDay?: boolean
  reason?: string | null
  contactDuringLeave?: string | null
  documentUrl?: string | null
}

export async function submitRequest(
  context: CurrentUserContext,
  tenantId: string,
  input: LeaveRequestInput,
) {
  const leaveType = await leaveRepo.findLeaveTypeById(
    tenantId,
    input.leaveTypeId,
  )
  if (!leaveType) throw new ValidationError('Leave type not found.')

  const days = computeLeaveDays(input.startDate, input.endDate, input.isHalfDay)
  if (days <= 0)
    throw new ValidationError(
      'Leave end date must be on or after the start date.',
    )

  const year = input.startDate.getUTCFullYear()

  const request = await prisma.$transaction(async (tx) => {
    // Ensure a balance row exists for this employee/type/year.
    const balance = await leaveRepo.upsertBalance(
      tenantId,
      { employeeId: input.employeeId, leaveTypeId: input.leaveTypeId, year },
      context.profileId,
      tx,
    )

    // Paid leave cannot over-draw the available balance.
    if (leaveType.isPaid && availableBalance(balance) < days) {
      throw new ConflictError(
        `Insufficient ${leaveType.name} balance: ${availableBalance(balance)} day(s) available, ${days} requested.`,
      )
    }

    const requestNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_LEAVE_REQUEST',
    })

    const created = await leaveRepo.createRequest(
      tenantId,
      {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        requestNumber,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays: days,
        isHalfDay: input.isHalfDay ?? false,
        reason: input.reason ?? null,
        contactDuringLeave: input.contactDuringLeave ?? null,
        documentUrl: input.documentUrl ?? null,
        statusCode: 'submitted',
      },
      context.profileId,
      tx,
    )

    // Hold the days in the pending bucket until a decision is made.
    await leaveRepo.adjustBalance(tenantId, balance.id, { pending: days }, tx)

    // Best-effort alert to the employee's manager.
    const employee = await employeeRepo.findEmployeeSummaryById(
      tenantId,
      input.employeeId,
      tx,
    )
    if (employee?.managerId) {
      const manager = await employeeRepo.findEmployeeSummaryById(
        tenantId,
        employee.managerId,
        tx,
      )
      if (manager?.profileId) {
        await notify(tx, tenantId, [manager.profileId], context.profileId, {
          eventType: 'hr.leave_requested',
          title: `Leave request ${requestNumber} needs your approval`,
          body: `${days} day(s) of ${leaveType.name}`,
          entityType: 'hr_leave_request',
          entityId: created.id,
        })
      }
    }

    return created
  })

  await audit(
    context,
    tenantId,
    'hr.leave_request',
    'hr_leave_request',
    request.id,
    {
      requestNumber: request.requestNumber,
      days,
    },
  )

  return serializeRecord(request)
}

export async function decideRequest(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  decision: 'approved' | 'rejected',
  comments?: string | null,
) {
  const existing = await leaveRepo.findRequestById(tenantId, id)
  if (!existing) throw new NotFoundError('Leave request not found.')
  if (existing.statusCode !== 'submitted') {
    throw new ConflictError('Only a submitted leave request can be decided.')
  }

  const days = Number(existing.totalDays)
  const year = new Date(existing.startDate).getUTCFullYear()

  const updated = await prisma.$transaction(async (tx) => {
    await leaveRepo.recordApproval(
      tenantId,
      {
        leaveRequestId: id,
        approverId: context.profileId,
        stepOrder: 1,
        decision,
        comments: comments ?? null,
      },
      tx,
    )

    await leaveRepo.updateRequestStatus(
      tenantId,
      id,
      decision,
      context.profileId,
      tx,
    )

    const balance = await leaveRepo.findBalance(
      tenantId,
      existing.employeeId,
      existing.leaveTypeId,
      year,
      tx,
    )
    if (balance) {
      if (decision === 'approved') {
        // Move the held days into used and draw down the balance.
        await leaveRepo.adjustBalance(
          tenantId,
          balance.id,
          { pending: -days, used: days, balance: -days },
          tx,
        )
      } else {
        // Release the hold.
        await leaveRepo.adjustBalance(
          tenantId,
          balance.id,
          { pending: -days },
          tx,
        )
      }
    }

    // Notify the requesting employee.
    const employee = await employeeRepo.findEmployeeSummaryById(
      tenantId,
      existing.employeeId,
      tx,
    )
    if (employee?.profileId) {
      await notify(tx, tenantId, [employee.profileId], context.profileId, {
        eventType: `hr.leave_${decision}`,
        title: `Your leave request ${existing.requestNumber} was ${decision}`,
        entityType: 'hr_leave_request',
        entityId: id,
      })
    }

    return leaveRepo.findRequestById(tenantId, id, tx)
  })

  await audit(context, tenantId, 'hr.leave_approve', 'hr_leave_request', id, {
    decision,
  })

  return updated
    ? {
        ...serializeRecord(updated),
        approvals: serializeRecords(updated.approvals),
      }
    : null
}

export async function cancelRequest(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const existing = await leaveRepo.findRequestById(tenantId, id)
  if (!existing) throw new NotFoundError('Leave request not found.')
  if (!['submitted', 'draft'].includes(existing.statusCode)) {
    throw new ConflictError(
      'Only a draft or submitted request can be cancelled.',
    )
  }

  const days = Number(existing.totalDays)
  const year = new Date(existing.startDate).getUTCFullYear()

  await prisma.$transaction(async (tx) => {
    await leaveRepo.updateRequestStatus(
      tenantId,
      id,
      'cancelled',
      context.profileId,
      tx,
    )
    if (existing.statusCode === 'submitted') {
      const balance = await leaveRepo.findBalance(
        tenantId,
        existing.employeeId,
        existing.leaveTypeId,
        year,
        tx,
      )
      if (balance) {
        await leaveRepo.adjustBalance(
          tenantId,
          balance.id,
          { pending: -days },
          tx,
        )
      }
    }
  })

  await audit(context, tenantId, 'hr.leave_request', 'hr_leave_request', id, {
    action: 'cancel',
  })
  return { id, cancelled: true }
}
