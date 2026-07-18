import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as accountRepo from '#/server/repos/fin-account-repo'
import * as fiscalRepo from '#/server/repos/fin-fiscal-repo'
import * as journalRepo from '#/server/repos/fin-journal-repo'
import { serializeJournalEntry } from '#/server/finance/finance-dto'
import type { JournalEntryDto } from '#/server/finance/finance-dto'
import { normalizeLines, sumBase } from '#/server/finance/journal-balancing'
import type { JournalLineInput } from '#/server/finance/journal-balancing'
import {
  applyDraftPostingSideEffects,
  reverseJournalEntry,
} from '#/server/finance/posting-engine'
import { assertPeriodOpenForPosting } from '#/server/finance/period-resolution'
import { requireSettings } from '#/server/finance/settings-service'
import { assertPodTransition } from '#/server/purchasing/pod-status-service'
import type { CurrentUserContext } from '#/types/auth'

// Manual journal-entry lifecycle: draft -> posted -> reversed. Manual entries
// respect control-account protection (allowManualJournal=false accounts are
// reserved for subledger-driven postings).

const ENTITY_TYPE = 'fin_journal_entry'

async function assertAccountsAllowManual(
  tenantId: string,
  lines: Array<JournalLineInput>,
): Promise<void> {
  const accountIds = [...new Set(lines.map((line) => line.accountId))]
  const accounts = await Promise.all(
    accountIds.map((id) => accountRepo.findAccountById(tenantId, id)),
  )

  for (const [index, account] of accounts.entries()) {
    if (!account) {
      throw new NotFoundError(`Account ${accountIds[index]} not found.`)
    }

    if (!account.isActive) {
      throw new ConflictError(`Account ${account.code} is inactive.`)
    }

    if (!account.isLeaf) {
      throw new ConflictError(
        `Account ${account.code} is a summary account and cannot be posted to.`,
      )
    }

    if (!account.allowManualJournal) {
      throw new ConflictError(
        `Account ${account.code} is subledger-controlled and rejects manual journals.`,
      )
    }

    if (account.currencyCode) {
      const mismatched = lines.find(
        (line) =>
          line.accountId === account.id &&
          line.currencyCode !== account.currencyCode,
      )

      if (mismatched) {
        throw new ConflictError(
          `Account ${account.code} only accepts ${account.currencyCode} postings.`,
        )
      }
    }
  }
}

export interface ManualJournalEntryInput {
  journalTypeCode?: string
  entryDate: Date
  referenceNumber?: string | null
  memo?: string | null
  currencyCode?: string
  isAdjustment?: boolean
  lines: Array<JournalLineInput>
}

export async function createDraftEntry(
  context: CurrentUserContext,
  tenantId: string,
  input: ManualJournalEntryInput,
): Promise<JournalEntryDto> {
  const settings = await requireSettings(tenantId)
  const journalType = await journalRepo.findJournalTypeByCode(
    tenantId,
    input.journalTypeCode ?? 'general',
  )

  if (!journalType) {
    throw new NotFoundError('Journal type not found.')
  }

  await assertAccountsAllowManual(tenantId, input.lines)

  const lines = normalizeLines(input.lines, settings.baseCurrencyCode)
  const totals = sumBase(lines)

  const period = await fiscalRepo.findPeriodForDate(tenantId, input.entryDate)

  if (!period) {
    throw new ConflictError(
      'No fiscal period covers the entry date. Create the fiscal year first.',
    )
  }

  const entry = await prisma.$transaction(async (tx) => {
    const entryNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'JOURNAL_ENTRY',
    })

    const created = await journalRepo.createEntry(
      tenantId,
      {
        entryNumber,
        journalTypeId: journalType.id,
        entryDate: input.entryDate,
        fiscalPeriodId: period.id,
        statusCode: 'draft',
        referenceNumber: input.referenceNumber ?? null,
        memo: input.memo ?? null,
        currencyCode: input.currencyCode ?? settings.baseCurrencyCode,
        totalBaseDebit: totals.totalBaseDebit,
        totalBaseCredit: totals.totalBaseCredit,
        createdBy: context.profileId,
        lines,
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.journal_draft_created',
        entityType: ENTITY_TYPE,
        entityId: created.id,
        newValues: { entryNumber, lineCount: lines.length },
      },
      tx,
    )

    return created
  })

  return serializeJournalEntry(entry)
}

export async function updateDraftEntry(
  context: CurrentUserContext,
  tenantId: string,
  entryId: string,
  input: ManualJournalEntryInput,
): Promise<JournalEntryDto> {
  const settings = await requireSettings(tenantId)
  const existing = await journalRepo.findEntryById(tenantId, entryId)

  if (!existing) {
    throw new NotFoundError('Journal entry not found.')
  }

  if (existing.statusCode !== 'draft') {
    throw new ConflictError('Only draft journal entries can be edited.')
  }

  await assertAccountsAllowManual(tenantId, input.lines)

  const lines = normalizeLines(input.lines, settings.baseCurrencyCode)
  const totals = sumBase(lines)

  const period = await fiscalRepo.findPeriodForDate(tenantId, input.entryDate)

  if (!period) {
    throw new ConflictError('No fiscal period covers the entry date.')
  }

  const journalType = input.journalTypeCode
    ? await journalRepo.findJournalTypeByCode(tenantId, input.journalTypeCode)
    : null

  await prisma.$transaction(async (tx) => {
    await journalRepo.replaceDraftLines(
      tenantId,
      entryId,
      lines,
      totals,
      {
        entryDate: input.entryDate,
        fiscalPeriodId: period.id,
        ...(journalType ? { journalTypeId: journalType.id } : {}),
        referenceNumber: input.referenceNumber ?? null,
        memo: input.memo ?? null,
        currencyCode: input.currencyCode ?? settings.baseCurrencyCode,
      },
      context.profileId,
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.journal_draft_updated',
        entityType: ENTITY_TYPE,
        entityId: entryId,
        newValues: { lineCount: lines.length },
      },
      tx,
    )
  })

  const updated = await journalRepo.findEntryById(tenantId, entryId)

  if (!updated) {
    throw new NotFoundError('Journal entry not found after update.')
  }

  return serializeJournalEntry(updated)
}

export async function postDraftEntry(
  context: CurrentUserContext,
  tenantId: string,
  entryId: string,
  options: { isAdjustment?: boolean } = {},
): Promise<JournalEntryDto> {
  const draft = await journalRepo.findEntryById(tenantId, entryId)

  if (!draft) {
    throw new NotFoundError('Journal entry not found.')
  }

  await assertPodTransition(tenantId, ENTITY_TYPE, draft.statusCode, 'posted')

  const period = await fiscalRepo.findPeriodById(tenantId, draft.fiscalPeriodId)

  assertPeriodOpenForPosting(period, draft.entryDate, {
    moduleCode: 'gl',
    allowAdjustmentPeriod: options.isAdjustment ?? false,
  })

  const posted = await prisma.$transaction(async (tx) => {
    // The draft already carries validated, normalized lines: flip its status
    // atomically, then apply balances via the engine primitives.
    const marked = await journalRepo.markEntryPosted(
      tenantId,
      draft.id,
      context.profileId,
      tx,
    )

    if (!marked) {
      throw new ConflictError('Journal entry could not be posted.')
    }

    await applyDraftPostingSideEffects(tx, {
      tenantId,
      entry: draft,
      actorProfileId: context.profileId,
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.journal_posted',
        entityType: ENTITY_TYPE,
        entityId: draft.id,
        newValues: { entryNumber: draft.entryNumber },
      },
      tx,
    )

    return journalRepo.findEntryById(tenantId, draft.id, tx)
  })

  if (!posted) {
    throw new NotFoundError('Journal entry not found after posting.')
  }

  return serializeJournalEntry(posted)
}

export async function reverseEntry(
  context: CurrentUserContext,
  tenantId: string,
  entryId: string,
  input: { reversalDate?: Date; memo?: string | null } = {},
): Promise<JournalEntryDto> {
  const settings = await requireSettings(tenantId)
  const original = await journalRepo.findEntryById(tenantId, entryId)

  if (!original) {
    throw new NotFoundError('Journal entry not found.')
  }

  await assertPodTransition(
    tenantId,
    ENTITY_TYPE,
    original.statusCode,
    'reversed',
  )

  const reversalDate = input.reversalDate ?? new Date()
  const period = await fiscalRepo.findPeriodForDate(tenantId, reversalDate)

  const reversal = await prisma.$transaction(async (tx) => {
    const entry = await reverseJournalEntry(tx, {
      tenantId,
      original,
      reversalDate,
      fiscalPeriod: assertPeriodOpenForPosting(period, reversalDate, {
        moduleCode: 'gl',
      }),
      baseCurrencyCode: settings.baseCurrencyCode,
      memo: input.memo ?? null,
      actorProfileId: context.profileId,
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.journal_reversed',
        entityType: ENTITY_TYPE,
        entityId: original.id,
        newValues: {
          reversalEntryId: entry.id,
          reversalEntryNumber: entry.entryNumber,
        },
      },
      tx,
    )

    return entry
  })

  return serializeJournalEntry(reversal)
}

export async function deleteDraftEntry(
  context: CurrentUserContext,
  tenantId: string,
  entryId: string,
): Promise<void> {
  const removed = await journalRepo.softDeleteDraftEntry(
    tenantId,
    entryId,
    context.profileId,
  )

  if (!removed) {
    throw new ConflictError('Only draft journal entries can be deleted.')
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actionKey: 'finance.journal_draft_deleted',
    entityType: ENTITY_TYPE,
    entityId: entryId,
  })
}

export async function getEntry(
  tenantId: string,
  entryId: string,
): Promise<JournalEntryDto> {
  const entry = await journalRepo.findEntryById(tenantId, entryId)

  if (!entry) {
    throw new NotFoundError('Journal entry not found.')
  }

  return serializeJournalEntry(entry)
}

export async function listEntriesDto(
  tenantId: string,
  options: Parameters<typeof journalRepo.listEntries>[1],
): Promise<Array<JournalEntryDto>> {
  const entries = await journalRepo.listEntries(tenantId, options)

  return entries.map(serializeJournalEntry)
}
