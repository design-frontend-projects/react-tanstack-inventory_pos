import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as noteService from '#/server/inventory/documents/financial-note-service'
import * as returnService from '#/server/inventory/documents/sales-return-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  creditNoteFromReturnSchema,
  debitNoteFromPurchaseReturnSchema,
  noteApplySchema,
  posRefundSchema,
  salesReturnCreateSchema,
} from '#/features/returns/validation'

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

// --- Sales returns ----------------------------------------------------------

export const listSalesReturnsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.view')

    return returnService.listSalesReturns(context, data.tenantId)
  })

export const getSalesReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.view')

    return returnService.getSalesReturn(context, data.tenantId, data.id)
  })

export const createSalesReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: salesReturnCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.create')

    return returnService.createSalesReturn(context, data.tenantId, data.input)
  })

export const submitSalesReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.create')

    return returnService.submitSalesReturn(context, data.tenantId, data.id)
  })

export const approveSalesReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.approve')

    return returnService.approveSalesReturn(context, data.tenantId, data.id)
  })

export const rejectSalesReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.approve')

    return returnService.rejectSalesReturn(context, data.tenantId, data.id)
  })

export const cancelSalesReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.create')

    return returnService.cancelSalesReturn(context, data.tenantId, data.id)
  })

export const receiveSalesReturnServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.receive')

    return returnService.receiveSalesReturn(context, data.tenantId, data.id)
  })

// POS counter refund sourced from a completed sale.
export const refundPosSaleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: posRefundSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.refund')

    return returnService.refundPosSale(context, data.tenantId, data.id, data.input)
  })

// --- Credit / debit notes ---------------------------------------------------

export const listNotesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.view')

    return noteService.listNotes(context, data.tenantId)
  })

export const getNoteServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'returns.view')

    return noteService.getNote(context, data.tenantId, data.id)
  })

export const createCreditNoteServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: creditNoteFromReturnSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'note.manage')

    return noteService.createCreditNoteFromReturn(context, data.tenantId, data.input.salesReturnId)
  })

export const createDebitNoteServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: debitNoteFromPurchaseReturnSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'note.manage')

    return noteService.createDebitNoteFromPurchaseReturn(
      context,
      data.tenantId,
      data.input.purchaseReturnId
    )
  })

export const issueNoteServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'note.manage')

    return noteService.issueNote(context, data.tenantId, data.id)
  })

export const applyNoteServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: noteApplySchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'note.manage')

    return noteService.applyNote(context, data.tenantId, data.id, data.input.amount)
  })

export const cancelNoteServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'note.manage')

    return noteService.cancelNote(context, data.tenantId, data.id)
  })
