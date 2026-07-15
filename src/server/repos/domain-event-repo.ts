import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// The outbox is append-only: no update or delete paths besides the retention
// prune. Events are appended inside the source service's transaction (pass the
// tx client) so the event commits atomically with the business write.

export interface AppendEventInput {
  eventType: string
  aggregateType: string
  aggregateId: string
  customerId?: string | null
  payloadJson: Prisma.InputJsonValue
  correlationId?: string | null
  actorProfileId?: string | null
  occurredAt?: Date
}

export async function appendEvent(
  tenantId: string,
  input: AppendEventInput,
  client: PrismaClientLike = prisma
) {
  return client.domainEvent.create({
    data: {
      tenantId,
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      customerId: input.customerId ?? null,
      payloadJson: input.payloadJson,
      correlationId: input.correlationId ?? null,
      actorProfileId: input.actorProfileId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  })
}

// Cross-tenant, cursor-ordered read used by projectors. Consumers filter by
// tenant inside their handlers; the cursor axis is the global bigserial `id`.
export function listEventsAfter(
  sequence: bigint,
  limit: number,
  client: PrismaClientLike = prisma
) {
  return client.domainEvent.findMany({
    where: { id: { gt: sequence } },
    orderBy: { id: 'asc' },
    take: limit,
  })
}

// Retention: only prune events every consumer has passed AND that are older
// than the cutoff. Timeline/ledger rows are the durable per-customer copies.
export async function pruneEventsBefore(
  sequence: bigint,
  olderThan: Date,
  client: PrismaClientLike = prisma
) {
  const result = await client.domainEvent.deleteMany({
    where: { id: { lt: sequence }, occurredAt: { lt: olderThan } },
  })

  return result.count
}
