import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as attendanceService from '#/server/hr/attendance-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  overtimeDecisionSchema,
  overtimeSchema,
  punchSchema,
  shiftWriteSchema,
} from '#/features/hr/attendance-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

// --- Shifts -----------------------------------------------------------------

export const listShiftsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_view')
    return attendanceService.listShifts(context, data.tenantId)
  })

export const createShiftServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: shiftWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_manage')
    return attendanceService.createShift(context, data.tenantId, data.input)
  })

export const updateShiftServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: shiftWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_manage')
    return attendanceService.updateShift(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteShiftServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_manage')
    return attendanceService.deleteShift(context, data.tenantId, data.id)
  })

// --- Punches + daily --------------------------------------------------------

export const recordPunchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: punchSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_manage')
    return attendanceService.recordPunch(context, data.tenantId, data.input)
  })

export const listDailyAttendanceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      employeeId: z.string().uuid().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_view')
    return attendanceService.listDaily(context, data.tenantId, {
      employeeId: data.employeeId,
      from: data.from,
      to: data.to,
    })
  })

// --- Overtime ---------------------------------------------------------------

export const listOvertimeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      employeeId: z.string().uuid().optional(),
      statusCode: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_view')
    return attendanceService.listOvertime(context, data.tenantId, {
      employeeId: data.employeeId,
      statusCode: data.statusCode,
    })
  })

export const submitOvertimeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: overtimeSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_manage')
    return attendanceService.submitOvertime(context, data.tenantId, data.input)
  })

export const decideOvertimeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: overtimeDecisionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.attendance_manage')
    return attendanceService.decideOvertime(
      context,
      data.tenantId,
      data.id,
      data.input.decision,
    )
  })
