import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as reportingService from '#/server/purchasing/reporting-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'

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

export const getPurchaseReportingSnapshotServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'purchase.po_view',
      'purchase.invoice_view',
    ])

    return reportingService.getPurchaseReportingSnapshot(context, data.tenantId)
  })

export const refreshPurchaseReportingServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return reportingService.refreshReportingMatviews(context, data.tenantId)
  })
