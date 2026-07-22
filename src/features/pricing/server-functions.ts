import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as pricingService from '#/server/inventory/pricing-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  priceListWriteSchema,
  productPriceFiltersSchema,
  productPriceWriteSchema,
} from '#/features/pricing/validation'

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

// --- Price lists ------------------------------------------------------------

export const listPriceListsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'product.view',
      'product.manage_pricing',
    ])

    return pricingService.listPriceLists(context, data.tenantId)
  })

export const createPriceListServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: priceListWriteSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_pricing')

    return pricingService.createPriceList(context, data.tenantId, data.input)
  })

export const updatePriceListServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: priceListWriteSchema.partial(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_pricing')

    return pricingService.updatePriceList(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deletePriceListServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_pricing')

    return pricingService.deletePriceList(context, data.tenantId, data.id)
  })

// --- Product prices (tiers) -------------------------------------------------

export const listProductPricesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      filters: productPriceFiltersSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'product.view',
      'product.manage_pricing',
    ])

    return pricingService.listProductPrices(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const upsertProductPriceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: productPriceWriteSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_pricing')

    return pricingService.upsertProductPrice(context, data.tenantId, data.input)
  })

export const deleteProductPriceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_pricing')

    return pricingService.deleteProductPrice(context, data.tenantId, data.id)
  })
