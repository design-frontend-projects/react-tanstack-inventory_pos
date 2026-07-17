import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as adjustmentService from '#/server/inventory/documents/stock-adjustment-service'
import * as lotSerialService from '#/server/inventory/lot-serial-service'
import * as reorderService from '#/server/inventory/reorder-service'
import * as reservationService from '#/server/inventory/reservation-service'
import * as stockQuery from '#/server/inventory/stock-query-service'
import * as valuationService from '#/server/inventory/valuation-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
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

// --- Stock reads ------------------------------------------------------------

export const listStockServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      filters: stockFilterSchema.optional(),
    }),
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
    }),
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
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return stockQuery.getProductStockSummary(
      context,
      data.tenantId,
      data.productId,
    )
  })

// --- Stock adjustments ------------------------------------------------------

export const listAdjustmentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'adjustment.view')

    return adjustmentService.listAdjustments(context, data.tenantId)
  })

export const getAdjustmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
    }),
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
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'adjustment.create')

    return adjustmentService.createAdjustment(
      context,
      data.tenantId,
      data.input,
    )
  })

export const postAdjustmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'adjustment.post')

    return adjustmentService.postAdjustment(context, data.tenantId, data.id)
  })

// --- Reservations -----------------------------------------------------------

export const listReservationsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return reservationService.listReservations(context, data.tenantId)
  })

// Sweep stale (expired) holds back to available. Intended for a scheduled job.
export const expireReservationsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.reserve')

    return reservationService.expireReservations(context, data.tenantId)
  })

// --- Lots & serials ---------------------------------------------------------

const lotStatusSchema = z.enum([
  'ACTIVE',
  'QUARANTINE',
  'EXPIRED',
  'RECALLED',
  'DEPLETED',
])
const serialStatusSchema = z.enum([
  'IN_STOCK',
  'RESERVED',
  'SOLD',
  'IN_TRANSIT',
  'RETURNED',
  'SCRAPPED',
  'IN_REPAIR',
])

export const listLotsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return lotSerialService.listLots(context, data.tenantId)
  })

export const listSerialsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return lotSerialService.listSerials(context, data.tenantId)
  })

export const pickFefoServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      productId: idSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return lotSerialService.pickFefo(context, data.tenantId, data.productId)
  })

export const setLotStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      status: lotStatusSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.manage_lots')

    return lotSerialService.setLotStatus(
      context,
      data.tenantId,
      data.id,
      data.status,
    )
  })

export const expireLotsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.manage_lots')

    return lotSerialService.expireLots(context, data.tenantId)
  })

export const setSerialStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      status: serialStatusSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.manage_serials')

    return lotSerialService.setSerialStatus(
      context,
      data.tenantId,
      data.id,
      data.status,
    )
  })

// --- Reorder rules & suggestions --------------------------------------------

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const periodKeySchema = z.string().regex(/^\d{4}-\d{2}$/)

const reorderRuleSchema = z.object({
  productId: idSchema,
  variantId: idSchema.nullish(),
  warehouseId: idSchema,
  minStock: decimalInput.optional(),
  maxStock: decimalInput.optional(),
  safetyStock: decimalInput.optional(),
  reorderPoint: decimalInput.optional(),
  reorderQty: decimalInput.optional(),
  economicOrderQty: decimalInput.nullish(),
  leadTimeDays: z.number().int().nonnegative().nullish(),
  preferredSupplierId: idSchema.nullish(),
  isActive: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
})

export const listReorderRulesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return reorderService.listReorderRules(context, data.tenantId)
  })

export const upsertReorderRuleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: reorderRuleSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.manage_reorder')

    return reorderService.upsertReorderRule(context, data.tenantId, data.input)
  })

export const deleteReorderRuleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.manage_reorder')

    return reorderService.deleteReorderRule(context, data.tenantId, data.id)
  })

export const reorderSuggestionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      warehouseId: idSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_stock')

    return reorderService.getReorderSuggestions(
      context,
      data.tenantId,
      data.warehouseId,
    )
  })

// --- Valuation & snapshots --------------------------------------------------

export const valuationSummaryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      warehouseId: idSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_valuation')

    return valuationService.getValuationSummary(
      context,
      data.tenantId,
      data.warehouseId,
    )
  })

export const listSnapshotsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      periodKey: periodKeySchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.view_valuation')

    return valuationService.listSnapshots(
      context,
      data.tenantId,
      data.periodKey,
    )
  })

// Materialize the period valuation snapshot (monthly job).
export const takeSnapshotServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      periodKey: periodKeySchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'inventory.manage_reorder')

    return valuationService.takeSnapshot(context, data.tenantId, data.periodKey)
  })
