import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as analytics from '#/server/inventory/analytics-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'

// Dashboard read endpoints. Kept apart from server-functions.ts so the ledger
// CRUD surface and the analytics surface stay independently small.

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

export const inventoryKpisServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return analytics.getInventoryKpis(context, data.tenantId)
  })

export const stockByCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      warehouseId: idSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_valuation')

    return analytics.getStockByCategory(
      context,
      data.tenantId,
      data.warehouseId,
    )
  })

export const topProductsByValueServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      limit: z.number().int().min(1).max(50).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_valuation')

    return analytics.getTopProductsByValue(context, data.tenantId, data.limit)
  })

export const movementTrendServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      warehouseId: idSchema.optional(),
      days: z.number().int().min(1).max(365).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_movements')

    return analytics.getMovementTrend(context, data.tenantId, {
      warehouseId: data.warehouseId,
      days: data.days,
    })
  })

export const warehouseSummariesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return analytics.getWarehouseSummaries(context, data.tenantId)
  })
