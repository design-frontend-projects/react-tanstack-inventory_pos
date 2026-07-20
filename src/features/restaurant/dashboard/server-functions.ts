import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as reporting from '#/server/restaurant/reporting/reporting-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import { reportingRangeSchema } from '#/features/restaurant/dashboard/validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})

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

export const getRestaurantDashboardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: reportingRangeSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.dashboard.view')
    return reporting.getDashboardSnapshot(context, data.tenantId, data.input)
  })

export const getRestaurantAnalyticsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: reportingRangeSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'res.analytics.view',
      'res.reports.view',
    ])
    return reporting.getAnalyticsSnapshot(context, data.tenantId, data.input)
  })

export const getRestaurantSalesReportServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: reportingRangeSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.reports.view')
    return reporting.getSalesReport(context, data.tenantId, data.input)
  })

export const getRestaurantItemsReportServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: reportingRangeSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.reports.view')
    return reporting.getItemsReport(context, data.tenantId, data.input)
  })
