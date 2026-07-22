import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as essService from '#/server/hr/ess-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  announcementSchema,
  announcementStatusSchema,
  employeeRequestSchema,
  requestStatusSchema,
} from '#/features/hr/ess-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })

// ESS read and write both require the base employee-view permission.
const ACCESS = 'hr.employee_view'

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

// --- Employee requests ------------------------------------------------------

export const listEmployeeRequestsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      employeeId: z.string().uuid().optional(),
      statusCode: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ACCESS)
    return essService.listRequests(context, data.tenantId, {
      employeeId: data.employeeId,
      statusCode: data.statusCode,
    })
  })

export const getEmployeeRequestServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ACCESS)
    return essService.getRequest(context, data.tenantId, data.id)
  })

export const submitEmployeeRequestServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: employeeRequestSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ACCESS)
    return essService.submitRequest(context, data.tenantId, data.input)
  })

export const setEmployeeRequestStatusServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId.extend({ input: requestStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ACCESS)
    return essService.setRequestStatus(
      context,
      data.tenantId,
      data.id,
      data.input.statusCode,
    )
  })

// --- Announcements ----------------------------------------------------------

export const listAnnouncementsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ statusCode: z.string().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ACCESS)
    return essService.listAnnouncements(context, data.tenantId, {
      statusCode: data.statusCode,
    })
  })

export const createAnnouncementServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: announcementSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ACCESS)
    return essService.createAnnouncement(context, data.tenantId, data.input)
  })

export const setAnnouncementStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: announcementStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ACCESS)
    return essService.setAnnouncementStatus(
      context,
      data.tenantId,
      data.id,
      data.input.statusCode,
    )
  })
