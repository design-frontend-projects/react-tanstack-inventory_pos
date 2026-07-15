import { mapEventToTimelineEntry } from '#/server/crm/timeline-mapper'
import type { DomainEvent } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'
import * as timelineRepo from '#/server/repos/crm-timeline-repo'

// Folds a domain event into the customer timeline. Idempotent: the unique
// sourceEventId makes a replayed event a no-op.

export async function projectTimeline(tx: PrismaClientLike, event: DomainEvent) {
  const draft = mapEventToTimelineEntry({
    eventId: event.eventId,
    eventType: event.eventType,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    customerId: event.customerId,
    payloadJson: event.payloadJson,
    occurredAt: event.occurredAt,
  })

  if (!draft) {
    return
  }

  await timelineRepo.appendEntry(
    event.tenantId,
    {
      customerId: draft.customerId,
      entryType: draft.entryType,
      title: draft.title,
      summaryJson: (draft.summaryJson ?? undefined) as never,
      refType: draft.refType,
      refId: draft.refId,
      sourceEventId: draft.sourceEventId,
      occurredAt: draft.occurredAt,
    },
    tx
  )
}
