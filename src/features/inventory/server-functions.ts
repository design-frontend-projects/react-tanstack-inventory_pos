import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as adjustmentService from '#/server/inventory/documents/stock-adjustment-service'
import * as stockQuery from '#/server/inventory/stock-query-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  adjustmentCreateSchema,
  movementFilterSchema,
  stockFilterSchema,
} from '#/features/inventory/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId
    ),
    permission
  )
}

// --- Stock reads ------------------------------------------------------------

export const listStockServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      filters: stockFilterSchema.optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return stockQuery.listStock(context, data.tenantId, data.filters ?? {})
  })

export const listMovementsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      filters: movementFilterSchema.optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_movements')

    return stockQuery.listMovements(context, data.tenantId, data.filters ?? {})
  })

export const getProductStockSummaryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      productId: idSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return stockQuery.getProductStockSummary(context, data.tenantId, data.productId)
  })

// --- Stock adjustments ------------------------------------------------------

export const listAdjustmentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'adjustment.view')

    return adjustmentService.listAdjustments(context, data.tenantId)
  })

export const getAdjustmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'adjustment.view')

    return adjustmentService.getAdjustment(context, data.tenantId, data.id)
  })

export const createAdjustmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: adjustmentCreateSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'adjustment.create')

    return adjustmentService.createAdjustment(context, data.tenantId, data.input)
  })

export const postAdjustmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'adjustment.post')

    return adjustmentService.postAdjustment(context, data.tenantId, data.id)
  })
