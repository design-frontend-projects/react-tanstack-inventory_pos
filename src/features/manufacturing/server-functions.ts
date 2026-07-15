import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as bomService from '#/server/inventory/documents/bom-service'
import * as productionService from '#/server/inventory/documents/production-order-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  bomCreateSchema,
  completeProductionSchema,
  productionOrderCreateSchema,
} from '#/features/manufacturing/validation'

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

const base = z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema })
const withId = base.extend({ id: idSchema })

// --- Bills of materials -----------------------------------------------------

export const listBomsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.view')

    return bomService.listBoms(context, data.tenantId)
  })

export const getBomServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.view')

    return bomService.getBom(context, data.tenantId, data.id)
  })

export const createBomServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: bomCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.manage_bom')

    return bomService.createBom(context, data.tenantId, data.input)
  })

// --- Production orders ------------------------------------------------------

export const listProductionOrdersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.view')

    return productionService.listProductionOrders(context, data.tenantId)
  })

export const getProductionOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.view')

    return productionService.getProductionOrder(context, data.tenantId, data.id)
  })

export const createProductionOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: productionOrderCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.create')

    return productionService.createProductionOrder(context, data.tenantId, data.input)
  })

export const planProductionOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.release')

    return productionService.planProductionOrder(context, data.tenantId, data.id)
  })

export const releaseProductionOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.release')

    return productionService.releaseProductionOrder(context, data.tenantId, data.id)
  })

export const consumeMaterialsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.consume')

    return productionService.consumeMaterials(context, data.tenantId, data.id)
  })

export const completeProductionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: completeProductionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.complete')

    return productionService.completeProduction(context, data.tenantId, data.id, data.input)
  })

export const cancelProductionOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'production.create')

    return productionService.cancelProductionOrder(context, data.tenantId, data.id)
  })
