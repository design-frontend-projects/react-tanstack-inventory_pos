import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as paymentService from '#/server/purchasing/supplier-payment-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  paymentAllocateSchema,
  paymentCreateSchema,
  paymentListSchema,
} from '#/features/purchasing/payment-validation'

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

export const listSupplierPaymentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: paymentListSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.payment_view')

    return paymentService.listSupplierPayments(
      context,
      data.tenantId,
      data.input ?? {},
    )
  })

export const getSupplierPaymentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.payment_view')

    return paymentService.getSupplierPayment(context, data.tenantId, data.id)
  })

export const createSupplierPaymentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: paymentCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.payment_manage')

    return paymentService.createSupplierPayment(
      context,
      data.tenantId,
      data.input,
    )
  })

export const allocateSupplierPaymentServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId.extend({ input: paymentAllocateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.payment_manage')

    return paymentService.allocateSupplierPayment(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const submitSupplierPaymentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.payment_manage')

    return paymentService.submitSupplierPaymentForApproval(
      context,
      data.tenantId,
      data.id,
    )
  })

export const postSupplierPaymentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.payment_manage')

    return paymentService.postSupplierPayment(context, data.tenantId, data.id)
  })

export const cancelSupplierPaymentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.payment_manage')

    return paymentService.cancelSupplierPayment(context, data.tenantId, data.id)
  })
