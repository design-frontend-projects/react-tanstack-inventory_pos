import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as countService from '#/server/inventory/documents/stock-count-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  stockCountCreateSchema,
  stockCountRecordSchema,
} from '#/features/inventory/counts/count-validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

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

const base = z.object({
  accessToken: accessTokenSchema,
  tenantId: tenantIdSchema,
})
const withId = base.extend({ id: idSchema })

export const listStockCountsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_view')

    return countService.listStockCounts(context, data.tenantId)
  })

export const getStockCountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_view')

    return countService.getStockCount(context, data.tenantId, data.id)
  })

export const createStockCountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: stockCountCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_manage')

    return countService.createStockCount(context, data.tenantId, data.input)
  })

export const startStockCountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_manage')

    return countService.startStockCount(context, data.tenantId, data.id)
  })

export const recordStockCountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: stockCountRecordSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_manage')

    return countService.recordCounts(
      context,
      data.tenantId,
      data.id,
      data.input.entries.map((entry) => ({
        lineId: entry.lineId,
        countedQty: String(entry.countedQty),
        notes: entry.notes ?? null,
      })),
    )
  })

export const reviewStockCountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_manage')

    return countService.reviewStockCount(context, data.tenantId, data.id)
  })

// Approval posts the variance adjustment, so it takes the dedicated approve
// permission rather than the manage permission.
export const approveStockCountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_approve')

    return countService.approveStockCount(context, data.tenantId, data.id)
  })

export const cancelStockCountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.count_manage')

    return countService.cancelStockCount(context, data.tenantId, data.id)
  })
