import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Journal types, entries, and lines. Posted entries are immutable — the only
// legal mutations are draft edits, draft → posted, and posted → reversed.

const entryInclude = {
  lines: { orderBy: { lineNumber: 'asc' } },
  journalType: true,
  fiscalPeriod: true,
} satisfies Prisma.FinJournalEntryInclude

export type FinJournalEntryWithLines = Prisma.FinJournalEntryGetPayload<{
  include: typeof entryInclude
}>

export interface FinJournalLineWriteInput {
  lineNumber: number
  accountId: string
  description?: string | null
  currencyCode: string
  exchangeRate: Prisma.Decimal | string | number
  debitAmount: Prisma.Decimal | string | number
  creditAmount: Prisma.Decimal | string | number
  baseDebitAmount: Prisma.Decimal | string | number
  baseCreditAmount: Prisma.Decimal | string | number
  partyType?: string | null
  partyId?: string | null
  costCenterId?: string | null
  projectId?: string | null
  branchId?: string | null
  warehouseId?: string | null
  taxCodeId?: string | null
  sourceLineId?: string | null
}

export interface FinJournalEntryCreateInput {
  entryNumber: string
  journalTypeId: string
  entryDate: Date
  fiscalPeriodId: string
  statusCode?: string
  sourceDocType?: string | null
  sourceDocId?: string | null
  sourceEventType?: string | null
  referenceNumber?: string | null
  memo?: string | null
  currencyCode?: string
  totalBaseDebit: Prisma.Decimal | string | number
  totalBaseCredit: Prisma.Decimal | string | number
  reversalOfEntryId?: string | null
  correlationId?: string | null
  createdBy?: string | null
  lines: Array<FinJournalLineWriteInput>
}

export function listJournalTypes(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.finJournalType.findMany({
    where: { OR: [{ tenantId }, { tenantId: null }], isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
}

export function findJournalTypeByCode(
  tenantId: string,
  code: string,
  client: PrismaClientLike = prisma,
) {
  return client.finJournalType.findFirst({
    where: { code, OR: [{ tenantId }, { tenantId: null }], isActive: true },
    orderBy: { tenantId: { sort: 'desc', nulls: 'last' } },
  })
}

export function findEntryById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<FinJournalEntryWithLines | null> {
  return client.finJournalEntry.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: entryInclude,
  })
}

export function listEntries(
  tenantId: string,
  options: {
    statusCode?: string
    journalTypeId?: string
    fiscalPeriodId?: string
    sourceDocType?: string
    dateFrom?: Date
    dateTo?: Date
    take?: number
  } = {},
  client: PrismaClientLike = prisma,
) {
  return client.finJournalEntry.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options.journalTypeId ? { journalTypeId: options.journalTypeId } : {}),
      ...(options.fiscalPeriodId
        ? { fiscalPeriodId: options.fiscalPeriodId }
        : {}),
      ...(options.sourceDocType ? { sourceDocType: options.sourceDocType } : {}),
      ...(options.dateFrom || options.dateTo
        ? {
            entryDate: {
              ...(options.dateFrom ? { gte: options.dateFrom } : {}),
              ...(options.dateTo ? { lte: options.dateTo } : {}),
            },
          }
        : {}),
    },
    include: entryInclude,
    orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
    take: options.take ?? 100,
  })
}

export function findPostedEntryBySource(
  tenantId: string,
  sourceDocType: string,
  sourceDocId: string,
  sourceEventType: string | null,
  client: PrismaClientLike = prisma,
): Promise<FinJournalEntryWithLines | null> {
  return client.finJournalEntry.findFirst({
    where: {
      tenantId,
      sourceDocType,
      sourceDocId,
      sourceEventType,
      statusCode: 'posted',
      reversalOfEntryId: null,
    },
    include: entryInclude,
  })
}

export function createEntry(
  tenantId: string,
  input: FinJournalEntryCreateInput,
  client: PrismaClientLike = prisma,
): Promise<FinJournalEntryWithLines> {
  return client.finJournalEntry.create({
    data: {
      tenantId,
      entryNumber: input.entryNumber,
      journalTypeId: input.journalTypeId,
      entryDate: input.entryDate,
      fiscalPeriodId: input.fiscalPeriodId,
      statusCode: input.statusCode ?? 'draft',
      sourceDocType: input.sourceDocType ?? null,
      sourceDocId: input.sourceDocId ?? null,
      sourceEventType: input.sourceEventType ?? null,
      referenceNumber: input.referenceNumber ?? null,
      memo: input.memo ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      totalBaseDebit: input.totalBaseDebit,
      totalBaseCredit: input.totalBaseCredit,
      reversalOfEntryId: input.reversalOfEntryId ?? null,
      correlationId: input.correlationId ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      lines: {
        create: input.lines.map((line) => ({
          tenantId,
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          description: line.description ?? null,
          currencyCode: line.currencyCode,
          exchangeRate: line.exchangeRate,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          baseDebitAmount: line.baseDebitAmount,
          baseCreditAmount: line.baseCreditAmount,
          partyType: line.partyType ?? null,
          partyId: line.partyId ?? null,
          costCenterId: line.costCenterId ?? null,
          projectId: line.projectId ?? null,
          branchId: line.branchId ?? null,
          warehouseId: line.warehouseId ?? null,
          taxCodeId: line.taxCodeId ?? null,
          sourceLineId: line.sourceLineId ?? null,
        })),
      },
    },
    include: entryInclude,
  })
}

// Replaces the line set of a DRAFT entry. Callers must have verified status.
export async function replaceDraftLines(
  tenantId: string,
  entryId: string,
  lines: Array<FinJournalLineWriteInput>,
  totals: {
    totalBaseDebit: Prisma.Decimal | string | number
    totalBaseCredit: Prisma.Decimal | string | number
  },
  header: {
    entryDate?: Date
    fiscalPeriodId?: string
    journalTypeId?: string
    referenceNumber?: string | null
    memo?: string | null
    currencyCode?: string
  },
  updatedBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  await client.finJournalLine.deleteMany({ where: { tenantId, entryId } })

  await client.finJournalLine.createMany({
    data: lines.map((line) => ({
      tenantId,
      entryId,
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      description: line.description ?? null,
      currencyCode: line.currencyCode,
      exchangeRate: new Prisma.Decimal(line.exchangeRate),
      debitAmount: new Prisma.Decimal(line.debitAmount),
      creditAmount: new Prisma.Decimal(line.creditAmount),
      baseDebitAmount: new Prisma.Decimal(line.baseDebitAmount),
      baseCreditAmount: new Prisma.Decimal(line.baseCreditAmount),
      partyType: line.partyType ?? null,
      partyId: line.partyId ?? null,
      costCenterId: line.costCenterId ?? null,
      projectId: line.projectId ?? null,
      branchId: line.branchId ?? null,
      warehouseId: line.warehouseId ?? null,
      taxCodeId: line.taxCodeId ?? null,
      sourceLineId: line.sourceLineId ?? null,
    })),
  })

  await client.finJournalEntry.updateMany({
    where: { id: entryId, tenantId, statusCode: 'draft', deletedAt: null },
    data: {
      totalBaseDebit: totals.totalBaseDebit,
      totalBaseCredit: totals.totalBaseCredit,
      ...header,
      updatedBy,
      versionNumber: { increment: 1 },
    },
  })
}

export async function markEntryPosted(
  tenantId: string,
  id: string,
  postedByProfileId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finJournalEntry.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode: 'posted',
      isPosted: true,
      postedAt: new Date(),
      postedByProfileId,
      updatedBy: postedByProfileId,
    },
  })

  return result.count > 0
}

export async function markEntryReversed(
  tenantId: string,
  id: string,
  actorProfileId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finJournalEntry.updateMany({
    where: { id, tenantId, statusCode: 'posted', deletedAt: null },
    data: { statusCode: 'reversed', updatedBy: actorProfileId },
  })

  return result.count > 0
}

export async function softDeleteDraftEntry(
  tenantId: string,
  id: string,
  actorProfileId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finJournalEntry.updateMany({
    where: { id, tenantId, statusCode: 'draft', deletedAt: null },
    data: { deletedAt: new Date(), deletedBy: actorProfileId },
  })

  return result.count > 0
}
