import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as invoiceService from '#/server/inventory/documents/sales-invoice-service'
import * as orderService from '#/server/inventory/documents/sales-order-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  invoiceFromOrderSchema,
  invoicePaymentSchema,
  salesOrderCreateSchema,
} from '#/features/sales/validation'

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

// --- Sales orders -----------------------------------------------------------

export const listSalesOrdersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_view')

    return orderService.listSalesOrders(context, data.tenantId)
  })

export const getSalesOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_view')

    return orderService.getSalesOrder(context, data.tenantId, data.id)
  })

export const createSalesOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: salesOrderCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_create')

    return orderService.createSalesOrder(context, data.tenantId, data.input)
  })

export const confirmSalesOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_confirm')

    return orderService.confirmSalesOrder(context, data.tenantId, data.id)
  })

export const fulfillSalesOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_fulfill')

    return orderService.fulfillSalesOrder(context, data.tenantId, data.id)
  })

export const cancelSalesOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_confirm')

    return orderService.cancelSalesOrder(context, data.tenantId, data.id)
  })

// --- Sales invoices ---------------------------------------------------------

export const listInvoicesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_view')

    return invoiceService.listInvoices(context, data.tenantId)
  })

export const getInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.order_view')

    return invoiceService.getInvoice(context, data.tenantId, data.id)
  })

export const createInvoiceFromOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: invoiceFromOrderSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.invoice_manage')

    return invoiceService.createInvoiceFromOrder(context, data.tenantId, data.input.salesOrderId)
  })

export const issueInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.invoice_manage')

    return invoiceService.issueInvoice(context, data.tenantId, data.id)
  })

export const recordInvoicePaymentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: invoicePaymentSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'sales.invoice_manage')

    return invoiceService.recordInvoicePayment(context, data.tenantId, data.id, data.input.amount)
  })
