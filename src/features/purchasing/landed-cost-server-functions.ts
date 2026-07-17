import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as landedCostService from '#/server/purchasing/landed-cost-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  landedCostAllocateSchema,
  landedCostCreateSchema,
  landedCostListSchema,
} from '#/features/purchasing/landed-cost-validation'

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

// Reads are open to invoice viewers (landed cost is part of the AP picture);
// all writes require the dedicated manage permission.
const VIEW = ['purchase.invoice_view', 'purchase.landed_cost_manage']

export const listLandedCostVouchersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: landedCostListSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)

    return landedCostService.listLandedCostVouchers(
      context,
      data.tenantId,
      data.input ?? {},
    )
  })

export const getLandedCostVoucherServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)

    return landedCostService.getLandedCostVoucher(
      context,
      data.tenantId,
      data.id,
    )
  })

export const createLandedCostVoucherServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: landedCostCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.landed_cost_manage')

    return landedCostService.createLandedCostVoucher(
      context,
      data.tenantId,
      data.input,
    )
  })

export const allocateLandedCostVoucherServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId.extend({ input: landedCostAllocateSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.landed_cost_manage')

    return landedCostService.allocateLandedCostVoucher(
      context,
      data.tenantId,
      data.id,
      data.input ?? {},
    )
  })

export const postLandedCostVoucherServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.landed_cost_manage')

    return landedCostService.postLandedCostVoucher(
      context,
      data.tenantId,
      data.id,
    )
  })

export const cancelLandedCostVoucherServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.landed_cost_manage')

    return landedCostService.cancelLandedCostVoucher(
      context,
      data.tenantId,
      data.id,
    )
  })
