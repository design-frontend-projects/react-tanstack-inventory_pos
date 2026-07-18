import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Posting rules (system defaults with tenant_id NULL + tenant overrides),
// the async posting queue, and the finance event-consumer cursor.

const ruleInclude = {
  lines: { orderBy: { lineNumber: 'asc' } },
} satisfies Prisma.FinPostingRuleInclude

export type FinPostingRuleWithLines = Prisma.FinPostingRuleGetPayload<{
  include: typeof ruleInclude
}>

// Tenant-specific rules shadow system rules for the same event type; within a
// scope the highest-priority active rule wins.
export async function resolveRuleForEvent(
  tenantId: string,
  eventType: string,
  client: PrismaClientLike = prisma,
): Promise<FinPostingRuleWithLines | null> {
  const rules = await client.finPostingRule.findMany({
    where: {
      eventType,
      isActive: true,
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
    },
    include: ruleInclude,
    orderBy: [{ tenantId: { sort: 'desc', nulls: 'last' } }, { priority: 'desc' }],
  })

  return rules[0] ?? null
}

export function listRules(
  tenantId: string,
  options: { eventType?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.finPostingRule.findMany({
    where: {
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
      ...(options.eventType ? { eventType: options.eventType } : {}),
    },
    include: ruleInclude,
    orderBy: [{ eventType: 'asc' }, { priority: 'desc' }],
  })
}

export interface FinPostingRuleLineInput {
  lineNumber: number
  lineRole: string
  side: 'debit' | 'credit'
  accountSource: 'fixed' | 'mapping' | 'settings_default'
  accountId?: string | null
  mappingEntityType?: string | null
  mappingRole?: string | null
  settingsField?: string | null
  amountSelector: string
  multiplier?: number
  description?: string | null
}

export interface FinPostingRuleUpsertInput {
  eventType: string
  sourceDocType?: string | null
  journalTypeCode?: string | null
  description?: string | null
  priority?: number
  conditions?: Prisma.InputJsonValue
  isActive?: boolean
  lines: Array<FinPostingRuleLineInput>
}

// Creates or replaces a TENANT rule (system rules are seed-managed).
export async function upsertTenantRule(
  tenantId: string,
  input: FinPostingRuleUpsertInput,
  actorProfileId: string | null = null,
  client: PrismaClientLike = prisma,
): Promise<FinPostingRuleWithLines> {
  const existing = await client.finPostingRule.findFirst({
    where: {
      tenantId,
      eventType: input.eventType,
      priority: input.priority ?? 100,
      deletedAt: null,
    },
  })

  if (existing) {
    await client.finPostingRuleLine.deleteMany({
      where: { ruleId: existing.id },
    })

    return client.finPostingRule.update({
      where: { id: existing.id },
      data: {
        sourceDocType: input.sourceDocType ?? null,
        journalTypeCode: input.journalTypeCode ?? null,
        description: input.description ?? null,
        conditions: input.conditions,
        isActive: input.isActive ?? true,
        updatedBy: actorProfileId,
        lines: {
          create: input.lines.map((line) => ({
            tenantId,
            lineNumber: line.lineNumber,
            lineRole: line.lineRole,
            side: line.side,
            accountSource: line.accountSource,
            accountId: line.accountId ?? null,
            mappingEntityType: line.mappingEntityType ?? null,
            mappingRole: line.mappingRole ?? null,
            settingsField: line.settingsField ?? null,
            amountSelector: line.amountSelector,
            multiplier: line.multiplier ?? 1,
            description: line.description ?? null,
          })),
        },
      },
      include: ruleInclude,
    })
  }

  return client.finPostingRule.create({
    data: {
      tenantId,
      eventType: input.eventType,
      sourceDocType: input.sourceDocType ?? null,
      journalTypeCode: input.journalTypeCode ?? null,
      description: input.description ?? null,
      priority: input.priority ?? 100,
      conditions: input.conditions,
      isActive: input.isActive ?? true,
      createdBy: actorProfileId,
      updatedBy: actorProfileId,
      lines: {
        create: input.lines.map((line) => ({
          tenantId,
          lineNumber: line.lineNumber,
          lineRole: line.lineRole,
          side: line.side,
          accountSource: line.accountSource,
          accountId: line.accountId ?? null,
          mappingEntityType: line.mappingEntityType ?? null,
          mappingRole: line.mappingRole ?? null,
          settingsField: line.settingsField ?? null,
          amountSelector: line.amountSelector,
          multiplier: line.multiplier ?? 1,
          description: line.description ?? null,
        })),
      },
    },
    include: ruleInclude,
  })
}

// --- Posting queue (Phase 2 consumer drains this) ---------------------------

export interface FinPostingQueueEnqueueInput {
  domainEventId?: string | null
  eventType: string
  sourceDocType: string
  sourceDocId: string
  payload?: Prisma.InputJsonValue
}

// Dedupe-safe enqueue: re-delivery of the same (event, doc) is a no-op.
export async function enqueue(
  tenantId: string,
  input: FinPostingQueueEnqueueInput,
  client: PrismaClientLike = prisma,
) {
  return client.finPostingQueue.upsert({
    where: {
      tenantId_eventType_sourceDocType_sourceDocId: {
        tenantId,
        eventType: input.eventType,
        sourceDocType: input.sourceDocType,
        sourceDocId: input.sourceDocId,
      },
    },
    create: {
      tenantId,
      domainEventId: input.domainEventId ?? null,
      eventType: input.eventType,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      payload: input.payload,
    },
    update: {},
  })
}

export function listPending(
  tenantId: string,
  now: Date,
  take = 50,
  client: PrismaClientLike = prisma,
) {
  return client.finPostingQueue.findMany({
    where: {
      tenantId,
      statusCode: 'pending',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take,
  })
}

export async function markProcessed(
  tenantId: string,
  id: string,
  outcome:
    | { statusCode: 'posted'; journalEntryId: string | null }
    | { statusCode: 'failed' | 'pending'; error: string; nextAttemptAt?: Date | null }
    | { statusCode: 'skipped'; error?: string },
  client: PrismaClientLike = prisma,
) {
  const result = await client.finPostingQueue.updateMany({
    where: { id, tenantId },
    data:
      outcome.statusCode === 'posted'
        ? {
            statusCode: 'posted',
            journalEntryId: outcome.journalEntryId,
            processedAt: new Date(),
            lastError: null,
          }
        : outcome.statusCode === 'skipped'
          ? {
              statusCode: 'skipped',
              processedAt: new Date(),
              lastError: outcome.error ?? null,
            }
          : {
              statusCode: outcome.statusCode,
              attemptCount: { increment: 1 },
              lastError: outcome.error,
              nextAttemptAt: outcome.nextAttemptAt ?? null,
            },
  })

  return result.count > 0
}

// --- Consumer cursors -------------------------------------------------------

export function findCursor(
  tenantId: string,
  consumerName: string,
  client: PrismaClientLike = prisma,
) {
  return client.finEventCursor.findFirst({
    where: { tenantId, consumerName },
  })
}

export async function saveCursor(
  tenantId: string,
  consumerName: string,
  lastEventId: string,
  client: PrismaClientLike = prisma,
) {
  return client.finEventCursor.upsert({
    where: { tenantId_consumerName: { tenantId, consumerName } },
    create: { tenantId, consumerName, lastEventId },
    update: { lastEventId },
  })
}
