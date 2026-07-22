import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as leaveService from '#/server/hr/leave-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  leaveBalanceGrantSchema,
  leaveDecisionSchema,
  leaveFiltersSchema,
  leaveRequestSchema,
  leaveTypeWriteSchema,
} from '#/features/hr/leave-validation'

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

// --- Leave types ------------------------------------------------------------

export const listLeaveTypesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.leave_view')
    return leaveService.listLeaveTypes(context, data.tenantId)
  })

export const createLeaveTypeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: leaveTypeWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return leaveService.createLeaveType(context, data.tenantId, data.input)
  })

export const updateLeaveTypeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: leaveTypeWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return leaveService.updateLeaveType(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteLeaveTypeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return leaveService.deleteLeaveType(context, data.tenantId, data.id)
  })

// --- Balances ---------------------------------------------------------------

export const listLeaveBalancesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      employeeId: z.string().uuid().optional(),
      year: z.number().int().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.leave_view')
    return leaveService.listBalances(context, data.tenantId, {
      employeeId: data.employeeId,
      year: data.year,
    })
  })

export const grantLeaveBalanceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: leaveBalanceGrantSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return leaveService.grantBalance(context, data.tenantId, data.input)
  })

// --- Requests ---------------------------------------------------------------

export const listLeaveRequestsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: leaveFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.leave_view')
    return leaveService.listRequests(context, data.tenantId, data.filters ?? {})
  })

export const getLeaveRequestServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.leave_view')
    return leaveService.getRequest(context, data.tenantId, data.id)
  })

export const submitLeaveRequestServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: leaveRequestSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.leave_request')
    return leaveService.submitRequest(context, data.tenantId, data.input)
  })

export const decideLeaveRequestServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: leaveDecisionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.leave_approve')
    return leaveService.decideRequest(
      context,
      data.tenantId,
      data.id,
      data.input.decision,
      data.input.comments,
    )
  })

export const cancelLeaveRequestServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.leave_request')
    return leaveService.cancelRequest(context, data.tenantId, data.id)
  })
