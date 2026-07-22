import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { computeDaily } from '#/server/hr/attendance-calc'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as attendanceRepo from '#/server/repos/hr-attendance-repo'
import type { CurrentUserContext } from '#/types/auth'

// Time & attendance service. Raw punches are recorded then reduced into the
// daily attendance row (logs → daily), the authoritative input to payroll.

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

function dayBounds(date: Date): { start: Date; end: Date; day: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end, day: start }
}

// --- Shifts -----------------------------------------------------------------

export async function listShifts(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await attendanceRepo.listShifts(tenantId))
}

export async function createShift(
  context: CurrentUserContext,
  tenantId: string,
  input: attendanceRepo.ShiftWriteInput,
) {
  const shift = await attendanceRepo.createShift(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.attendance_manage',
    'hr_shift_definition',
    shift.id,
    { code: shift.code },
  )
  return serializeRecord(shift)
}

export async function updateShift(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<attendanceRepo.ShiftWriteInput>,
) {
  const shift = await attendanceRepo.updateShift(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!shift) throw new NotFoundError('Shift not found.')
  await audit(
    context,
    tenantId,
    'hr.attendance_manage',
    'hr_shift_definition',
    id,
    null,
  )
  return serializeRecord(shift)
}

export async function deleteShift(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await attendanceRepo.softDeleteShift(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Shift not found.')
  await audit(
    context,
    tenantId,
    'hr.attendance_manage',
    'hr_shift_definition',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Punches + daily calculation --------------------------------------------

export interface PunchServiceInput {
  employeeId: string
  eventTime: Date
  direction: string
  captureMethod?: string
  shiftId?: string | null
}

// Records a punch and recomputes that employee-day's daily attendance from all
// of the day's punches against the (optional) shift.
export async function recordPunch(
  context: CurrentUserContext,
  tenantId: string,
  input: PunchServiceInput,
) {
  const { start, end, day } = dayBounds(input.eventTime)

  const daily = await prisma.$transaction(async (tx) => {
    await attendanceRepo.createPunch(
      tenantId,
      {
        employeeId: input.employeeId,
        eventTime: input.eventTime,
        direction: input.direction,
        captureMethod: input.captureMethod,
      },
      tx,
    )

    const punches = await attendanceRepo.listPunchesForDay(
      tenantId,
      input.employeeId,
      start,
      end,
      tx,
    )
    const shift = input.shiftId
      ? await attendanceRepo.findShiftById(tenantId, input.shiftId, tx)
      : null

    const calc = computeDaily(
      punches.map((p) => ({ eventTime: p.eventTime, direction: p.direction })),
      shift
        ? {
            startTime: shift.startTime,
            endTime: shift.endTime,
            workHours: shift.workHours ? Number(shift.workHours) : null,
            graceInMins: shift.graceInMins,
            graceOutMins: shift.graceOutMins,
          }
        : null,
    )

    return attendanceRepo.upsertDaily(
      tenantId,
      {
        employeeId: input.employeeId,
        workDate: day,
        shiftId: input.shiftId ?? null,
        firstIn: calc.firstIn,
        lastOut: calc.lastOut,
        workedHours: calc.workedHours,
        overtimeHours: calc.overtimeHours,
        lateMinutes: calc.lateMinutes,
        earlyOutMins: calc.earlyOutMins,
        attendanceCode: calc.attendanceCode,
      },
      context.profileId,
      tx,
    )
  })

  await audit(
    context,
    tenantId,
    'hr.attendance_manage',
    'hr_attendance_daily',
    daily.id,
    {
      workDate: day.toISOString(),
    },
  )

  return serializeRecord(daily)
}

export async function listDaily(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; from?: Date; to?: Date } = {},
) {
  return serializeRecords(await attendanceRepo.listDaily(tenantId, filters))
}

// --- Overtime ---------------------------------------------------------------

export async function listOvertime(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await attendanceRepo.listOvertime(tenantId, filters))
}

export interface OvertimeSubmitInput {
  employeeId: string
  overtimeDate: Date
  startTime?: string | null
  endTime?: string | null
  hours: string | number
  rateMultiplier?: string | number
  reason?: string | null
}

export async function submitOvertime(
  context: CurrentUserContext,
  tenantId: string,
  input: OvertimeSubmitInput,
) {
  const overtime = await prisma.$transaction(async (tx) => {
    const requestNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_OVERTIME_REQUEST',
    })
    return attendanceRepo.createOvertime(
      tenantId,
      { ...input, requestNumber, statusCode: 'submitted' },
      context.profileId,
      tx,
    )
  })
  await audit(
    context,
    tenantId,
    'hr.attendance_manage',
    'hr_overtime_request',
    overtime.id,
    {
      requestNumber: overtime.requestNumber,
    },
  )
  return serializeRecord(overtime)
}

export async function decideOvertime(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  decision: 'approved' | 'rejected',
) {
  const existing = await attendanceRepo.findOvertimeById(tenantId, id)
  if (!existing) throw new NotFoundError('Overtime request not found.')
  if (existing.statusCode !== 'submitted') {
    throw new ConflictError('Only a submitted overtime request can be decided.')
  }
  await attendanceRepo.updateOvertimeStatus(
    tenantId,
    id,
    decision,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.attendance_manage',
    'hr_overtime_request',
    id,
    { decision },
  )
  return { id, statusCode: decision }
}
