import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Append-only timeline. Event-sourced rows carry a unique sourceEventId so a
// replayed event is a silent no-op; manual notes have no sourceEventId.

export interface TimelineEntryInput {
  customerId: string
  entryType: string
  title: string
  summaryJson?: Prisma.InputJsonValue | null
  refType?: string | null
  refId?: string | null
  sourceEventId?: string | null
  occurredAt: Date
  createdByProfileId?: string | null
}

// Returns the created row, or null when the sourceEventId was already
// projected (unique violation ⇒ at-least-once replay, safe to skip).
export async function appendEntry(
  tenantId: string,
  input: TimelineEntryInput,
  client: PrismaClientLike = prisma
) {
  try {
    return await client.crmTimelineEntry.create({
      data: {
        tenantId,
        customerId: input.customerId,
        entryType: input.entryType,
        title: input.title,
        summaryJson: input.summaryJson ?? undefined,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        occurredAt: input.occurredAt,
        createdByProfileId: input.createdByProfileId ?? null,
      },
    })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      input.sourceEventId
    ) {
      return null
    }

    throw error
  }
}

export interface TimelineFilters {
  entryType?: string
  before?: Date
  take?: number
}

export function listTimeline(
  tenantId: string,
  customerId: string,
  filters: TimelineFilters = {},
  client: PrismaClientLike = prisma
) {
  return client.crmTimelineEntry.findMany({
    where: {
      tenantId,
      customerId,
      ...(filters.entryType ? { entryType: filters.entryType } : {}),
      ...(filters.before ? { occurredAt: { lt: filters.before } } : {}),
    },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: Math.min(filters.take ?? 50, 200),
  })
}
