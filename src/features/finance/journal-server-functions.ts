import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as journalService from '#/server/finance/journal-service'
import { serializeTrialBalanceRow } from '#/server/finance/finance-dto'
import * as glBalanceRepo from '#/server/repos/fin-gl-balance-repo'
import * as journalRepo from '#/server/repos/fin-journal-repo'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  journalEntryCreateSchema,
  journalEntryListSchema,
  journalPostSchema,
  journalReverseSchema,
  trialBalanceSchema,
} from '#/features/finance/finance-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })

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

export const listJournalTypesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.journal_view')
    return journalRepo.listJournalTypes(data.tenantId)
  })

export const listJournalEntriesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: journalEntryListSchema.optional() }))
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.journal_view')
    return journalService.listEntriesDto(data.tenantId, data.input ?? {})
  })

export const getJournalEntryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.journal_view')
    return journalService.getEntry(data.tenantId, data.id)
  })

export const createJournalEntryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: journalEntryCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.journal_create')
    return journalService.createDraftEntry(context, data.tenantId, data.input)
  })

export const updateJournalEntryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: journalEntryCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.journal_create')
    return journalService.updateDraftEntry(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const postJournalEntryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: journalPostSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.journal_post')
    return journalService.postDraftEntry(
      context,
      data.tenantId,
      data.id,
      data.input ?? {},
    )
  })

export const reverseJournalEntryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: journalReverseSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.journal_reverse')
    return journalService.reverseEntry(
      context,
      data.tenantId,
      data.id,
      data.input ?? {},
    )
  })

export const deleteJournalEntryDraftServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.journal_create')
    await journalService.deleteDraftEntry(context, data.tenantId, data.id)
    return { success: true }
  })

export const readTrialBalanceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: trialBalanceSchema }))
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.journal_view')
    const rows = await glBalanceRepo.readTrialBalance(
      data.tenantId,
      data.input.fiscalPeriodIds,
    )
    return rows.map(serializeTrialBalanceRow)
  })
