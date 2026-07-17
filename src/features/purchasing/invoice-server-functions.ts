import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as debitNoteService from '#/server/purchasing/debit-note-service'
import * as invoiceService from '#/server/purchasing/supplier-invoice-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  debitNoteLinesSchema,
  invoiceCreateSchema,
  invoiceFromPoSchema,
  invoiceListSchema,
  invoicePostSchema,
} from '#/features/purchasing/invoice-validation'

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

// --- Supplier invoices (AP) ---------------------------------------------------

export const listSupplierInvoicesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: invoiceListSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_view')

    return invoiceService.listSupplierInvoices(
      context,
      data.tenantId,
      data.input ?? {},
    )
  })

export const getSupplierInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_view')

    return invoiceService.getSupplierInvoice(context, data.tenantId, data.id)
  })

export const createSupplierInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: invoiceCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_manage')

    return invoiceService.createSupplierInvoice(
      context,
      data.tenantId,
      data.input,
    )
  })

export const createSupplierInvoiceFromPoServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: invoiceFromPoSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_manage')

    return invoiceService.createSupplierInvoiceFromPo(
      context,
      data.tenantId,
      data.input,
    )
  })

export const matchSupplierInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_match')

    return invoiceService.matchSupplierInvoice(context, data.tenantId, data.id)
  })

export const submitSupplierInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_manage')

    return invoiceService.submitSupplierInvoiceForApproval(
      context,
      data.tenantId,
      data.id,
    )
  })

export const postSupplierInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: invoicePostSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_manage')

    return invoiceService.postSupplierInvoice(
      context,
      data.tenantId,
      data.id,
      data.input ?? {},
    )
  })

export const disputeSupplierInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_manage')

    return invoiceService.disputeSupplierInvoice(
      context,
      data.tenantId,
      data.id,
    )
  })

export const resolveSupplierInvoiceDisputeServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_manage')

    return invoiceService.resolveSupplierInvoiceDispute(
      context,
      data.tenantId,
      data.id,
    )
  })

export const cancelSupplierInvoiceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.invoice_manage')

    return invoiceService.cancelSupplierInvoice(context, data.tenantId, data.id)
  })

// --- Debit-note lines ---------------------------------------------------------

export const setDebitNoteLinesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: debitNoteLinesSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.debit_note_manage')

    return debitNoteService.setDebitNoteLines(
      context,
      data.tenantId,
      data.input.financialNoteId,
      data.input.lines,
    )
  })

export const listDebitNoteLinesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ financialNoteId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'purchase.invoice_view',
      'purchase.debit_note_manage',
    ])

    return debitNoteService.listDebitNoteLines(
      context,
      data.tenantId,
      data.financialNoteId,
    )
  })
