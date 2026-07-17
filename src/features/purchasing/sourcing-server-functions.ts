import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as rfqService from '#/server/purchasing/rfq-service'
import * as quotationService from '#/server/purchasing/quotation-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  quotationConvertSchema,
  quotationCreateSchema,
  quotationListSchema,
  rfqAwardSchema,
  rfqCreateSchema,
  rfqListSchema,
  rfqReviseSchema,
} from '#/features/purchasing/sourcing-validation'

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

// --- RFQs ---------------------------------------------------------------------

export const listRfqsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: rfqListSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.rfq_view')

    return rfqService.listRfqs(context, data.tenantId, data.input ?? {})
  })

export const getRfqServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.rfq_view')

    return rfqService.getRfq(context, data.tenantId, data.id)
  })

export const getRfqComparisonServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'purchase.rfq_view',
      'purchase.quotation_view',
    ])

    return rfqService.getRfqComparison(context, data.tenantId, data.id)
  })

export const createRfqServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: rfqCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.rfq_manage')

    return rfqService.createRfq(context, data.tenantId, data.input)
  })

export const reviseRfqServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: rfqReviseSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.rfq_manage')

    return rfqService.reviseRfq(context, data.tenantId, data.id, data.input)
  })

export const cancelRfqServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.rfq_manage')

    return rfqService.cancelRfq(context, data.tenantId, data.id)
  })

export const expireRfqServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.rfq_manage')

    return rfqService.expireRfq(context, data.tenantId, data.id)
  })

export const awardRfqServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: rfqAwardSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_award')

    return rfqService.awardRfq(context, data.tenantId, data.id, data.input)
  })

export const convertQuotationToPoServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: quotationConvertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'purchase.quotation_award',
      'purchase.po_create',
    ])

    return rfqService.convertQuotationToPurchaseOrder(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

// --- Supplier quotations --------------------------------------------------------

export const listQuotationsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: quotationListSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_view')

    return quotationService.listQuotations(
      context,
      data.tenantId,
      data.input ?? {},
    )
  })

export const getQuotationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_view')

    return quotationService.getQuotation(context, data.tenantId, data.id)
  })

export const recordQuotationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: quotationCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_manage')

    return quotationService.recordQuotation(context, data.tenantId, data.input)
  })

export const submitQuotationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_manage')

    return quotationService.submitQuotation(context, data.tenantId, data.id)
  })

export const reviewQuotationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_manage')

    return quotationService.reviewQuotation(context, data.tenantId, data.id)
  })

export const approveQuotationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_manage')

    return quotationService.approveQuotation(context, data.tenantId, data.id)
  })

export const rejectQuotationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.quotation_manage')

    return quotationService.rejectQuotation(context, data.tenantId, data.id)
  })
