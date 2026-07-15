import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'
import type {
  DomainEventPayloadMap,
  DomainEventType,
} from '#/server/events/domain-event-types'
import * as domainEventRepo from '#/server/repos/domain-event-repo'

// Transactional-outbox emitter. MUST be called with the transaction client of
// the business write so the event commits (or rolls back) atomically with it.
// Never catch/swallow failures here — a lost event is a correctness bug.

export interface AppendDomainEventInput<T extends DomainEventType> {
  tenantId: string
  eventType: T
  aggregateType: string
  aggregateId: string
  customerId?: string | null
  payload: DomainEventPayloadMap[T]
  correlationId?: string | null
  actorProfileId?: string | null
  occurredAt?: Date
}

export async function appendDomainEvent<T extends DomainEventType>(
  tx: PrismaClientLike,
  input: AppendDomainEventInput<T>
) {
  return domainEventRepo.appendEvent(
    input.tenantId,
    {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      customerId: input.customerId ?? null,
      payloadJson: input.payload as unknown as Prisma.InputJsonValue,
      correlationId: input.correlationId ?? null,
      actorProfileId: input.actorProfileId ?? null,
      occurredAt: input.occurredAt,
    },
    tx
  )
}
