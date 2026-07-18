import { Prisma } from '#/server/db/generated/prisma/client'
import { ConflictError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import * as glBalanceRepo from '#/server/repos/fin-gl-balance-repo'
import * as journalRepo from '#/server/repos/fin-journal-repo'
import {
  assertBalanced,
  buildReversalLines,
  withRoundingLine,
} from '#/server/finance/journal-balancing'
import type { NormalizedJournalLine } from '#/server/finance/journal-balancing'
import { assertPeriodOpenForPosting } from '#/server/finance/period-resolution'
import type {
  PeriodGateOptions,
  ResolvablePeriod,
} from '#/server/finance/period-resolution'

// The transactional core of the accounting engine. postJournalEntry() MUST be
// called with an in-flight transaction client: it writes the entry + lines,
// increments fin_gl_balances, and emits the domain event atomically. The DB
// backs it up with the deferred balance trigger and the partial unique
// idempotency index on (source_doc_type, source_doc_id, source_event_type).

export class DuplicateSourcePostingError extends ConflictError {
  constructor(readonly existingEntryId: string) {
    super('This source document/event has already been posted.')
    this.name = 'DuplicateSourcePostingError'
  }
}

export interface PostJournalEntryInput {
  tenantId: string
  journalTypeId: string
  entryDate: Date
  fiscalPeriod: ResolvablePeriod
  periodGate?: PeriodGateOptions
  lines: Array<NormalizedJournalLine>
  currencyCode?: string
  roundingAccountId?: string | null
  baseCurrencyCode: string
  sourceDocType?: string | null
  sourceDocId?: string | null
  sourceEventType?: string | null
  referenceNumber?: string | null
  memo?: string | null
  reversalOfEntryId?: string | null
  correlationId?: string | null
  actorProfileId?: string | null
  entryNumber?: string
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

async function applyGlDeltas(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fiscalPeriodId: string,
  lines: Array<NormalizedJournalLine>,
): Promise<void> {
  // One upsert per (account, currency) pair keeps the write count low on
  // wide entries.
  const grouped = new Map<
    string,
    {
      accountId: string
      currencyCode: string
      debit: Prisma.Decimal
      credit: Prisma.Decimal
      baseDebit: Prisma.Decimal
      baseCredit: Prisma.Decimal
    }
  >()

  for (const line of lines) {
    const key = `${line.accountId}:${line.currencyCode}`
    const bucket = grouped.get(key) ?? {
      accountId: line.accountId,
      currencyCode: line.currencyCode,
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
      baseDebit: new Prisma.Decimal(0),
      baseCredit: new Prisma.Decimal(0),
    }

    grouped.set(key, {
      ...bucket,
      debit: bucket.debit.plus(line.debitAmount),
      credit: bucket.credit.plus(line.creditAmount),
      baseDebit: bucket.baseDebit.plus(line.baseDebitAmount),
      baseCredit: bucket.baseCredit.plus(line.baseCreditAmount),
    })
  }

  for (const delta of grouped.values()) {
    await glBalanceRepo.applyBalanceDelta(
      tenantId,
      {
        accountId: delta.accountId,
        fiscalPeriodId,
        currencyCode: delta.currencyCode,
        debit: delta.debit,
        credit: delta.credit,
        baseDebit: delta.baseDebit,
        baseCredit: delta.baseCredit,
      },
      tx,
    )
  }
}

export async function postJournalEntry(
  tx: Prisma.TransactionClient,
  input: PostJournalEntryInput,
): Promise<journalRepo.FinJournalEntryWithLines> {
  assertPeriodOpenForPosting(
    input.fiscalPeriod,
    input.entryDate,
    input.periodGate,
  )

  const lines = withRoundingLine(
    input.lines,
    input.roundingAccountId ?? null,
    input.baseCurrencyCode,
  )
  const totals = assertBalanced(lines)

  const entryNumber =
    input.entryNumber ??
    (await nextDocumentNumber(tx, {
      tenantId: input.tenantId,
      documentType: 'JOURNAL_ENTRY',
    }))

  let entry: journalRepo.FinJournalEntryWithLines

  try {
    entry = await journalRepo.createEntry(
      input.tenantId,
      {
        entryNumber,
        journalTypeId: input.journalTypeId,
        entryDate: input.entryDate,
        fiscalPeriodId: input.fiscalPeriod.id,
        statusCode: 'posted',
        sourceDocType: input.sourceDocType ?? null,
        sourceDocId: input.sourceDocId ?? null,
        sourceEventType: input.sourceEventType ?? null,
        referenceNumber: input.referenceNumber ?? null,
        memo: input.memo ?? null,
        currencyCode: input.currencyCode ?? input.baseCurrencyCode,
        totalBaseDebit: totals.totalBaseDebit,
        totalBaseCredit: totals.totalBaseCredit,
        reversalOfEntryId: input.reversalOfEntryId ?? null,
        correlationId: input.correlationId ?? null,
        createdBy: input.actorProfileId ?? null,
        lines,
      },
      tx,
    )
  } catch (error: unknown) {
    // Idempotency: a concurrent/duplicate delivery of the same source event
    // trips fin_journal_entries_source_unique. Surface the existing entry id.
    if (isUniqueViolation(error) && input.sourceDocType && input.sourceDocId) {
      const existing = await journalRepo.findPostedEntryBySource(
        input.tenantId,
        input.sourceDocType,
        input.sourceDocId,
        input.sourceEventType ?? null,
        tx,
      )

      if (existing) {
        throw new DuplicateSourcePostingError(existing.id)
      }
    }

    throw error
  }

  await journalRepo.markEntryPosted(
    input.tenantId,
    entry.id,
    input.actorProfileId ?? null,
    tx,
  )

  await applyGlDeltas(tx, input.tenantId, input.fiscalPeriod.id, lines)

  await appendDomainEvent(tx, {
    tenantId: input.tenantId,
    eventType: 'fin_journal_entry.posted',
    aggregateType: 'fin_journal_entry',
    aggregateId: entry.id,
    payload: {
      entryNumber,
      journalTypeId: input.journalTypeId,
      totalBaseDebit: totals.totalBaseDebit.toString(),
      totalBaseCredit: totals.totalBaseCredit.toString(),
      sourceDocType: input.sourceDocType ?? null,
      sourceDocId: input.sourceDocId ?? null,
    },
    correlationId: input.correlationId ?? null,
    actorProfileId: input.actorProfileId ?? null,
  })

  return entry
}

// Side effects when an existing DRAFT entry (lines already stored and
// validated) is flipped to posted: GL balance deltas + outbox event. Runs on
// the posting transaction; the deferred DB trigger re-checks balance at commit.
export async function applyDraftPostingSideEffects(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string
    entry: journalRepo.FinJournalEntryWithLines
    actorProfileId?: string | null
  },
): Promise<void> {
  const lines: Array<NormalizedJournalLine> = input.entry.lines.map((line) => ({
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    description: line.description,
    currencyCode: line.currencyCode,
    exchangeRate: line.exchangeRate,
    debitAmount: line.debitAmount,
    creditAmount: line.creditAmount,
    baseDebitAmount: line.baseDebitAmount,
    baseCreditAmount: line.baseCreditAmount,
    partyType: line.partyType,
    partyId: line.partyId,
    costCenterId: line.costCenterId,
    projectId: line.projectId,
    branchId: line.branchId,
    warehouseId: line.warehouseId,
    taxCodeId: line.taxCodeId,
    sourceLineId: line.sourceLineId,
  }))

  const totals = assertBalanced(lines)

  await applyGlDeltas(tx, input.tenantId, input.entry.fiscalPeriodId, lines)

  await appendDomainEvent(tx, {
    tenantId: input.tenantId,
    eventType: 'fin_journal_entry.posted',
    aggregateType: 'fin_journal_entry',
    aggregateId: input.entry.id,
    payload: {
      entryNumber: input.entry.entryNumber,
      journalTypeId: input.entry.journalTypeId,
      totalBaseDebit: totals.totalBaseDebit.toString(),
      totalBaseCredit: totals.totalBaseCredit.toString(),
      sourceDocType: input.entry.sourceDocType,
      sourceDocId: input.entry.sourceDocId,
    },
    correlationId: input.entry.correlationId,
    actorProfileId: input.actorProfileId ?? null,
  })
}

// Reversal-only corrections: mark the original reversed and post the
// mirror-image entry into the target (open) period. Returns the reversal.
export async function reverseJournalEntry(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string
    original: journalRepo.FinJournalEntryWithLines
    reversalDate: Date
    fiscalPeriod: ResolvablePeriod
    baseCurrencyCode: string
    memo?: string | null
    actorProfileId?: string | null
    correlationId?: string | null
  },
): Promise<journalRepo.FinJournalEntryWithLines> {
  if (input.original.statusCode !== 'posted') {
    throw new ConflictError('Only posted journal entries can be reversed.')
  }

  const reversed = await journalRepo.markEntryReversed(
    input.tenantId,
    input.original.id,
    input.actorProfileId ?? null,
    tx,
  )

  if (!reversed) {
    throw new ConflictError('Journal entry is no longer reversible.')
  }

  const reversalEntry = await postJournalEntry(tx, {
    tenantId: input.tenantId,
    journalTypeId: input.original.journalTypeId,
    entryDate: input.reversalDate,
    fiscalPeriod: input.fiscalPeriod,
    lines: buildReversalLines(input.original.lines),
    currencyCode: input.original.currencyCode,
    baseCurrencyCode: input.baseCurrencyCode,
    sourceDocType: input.original.sourceDocType,
    sourceDocId: input.original.sourceDocId,
    sourceEventType: input.original.sourceEventType
      ? `${input.original.sourceEventType}.reversal`
      : null,
    referenceNumber: input.original.entryNumber,
    memo: input.memo ?? `Reversal of ${input.original.entryNumber}`,
    reversalOfEntryId: input.original.id,
    correlationId: input.correlationId ?? input.original.correlationId,
    actorProfileId: input.actorProfileId ?? null,
  })

  await appendDomainEvent(tx, {
    tenantId: input.tenantId,
    eventType: 'fin_journal_entry.reversed',
    aggregateType: 'fin_journal_entry',
    aggregateId: input.original.id,
    payload: {
      entryNumber: input.original.entryNumber,
      reversalEntryId: reversalEntry.id,
      reversalEntryNumber: reversalEntry.entryNumber,
    },
    correlationId: input.correlationId ?? null,
    actorProfileId: input.actorProfileId ?? null,
  })

  return reversalEntry
}
