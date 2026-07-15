import { evaluateCustomerSegments } from '#/server/crm/segment-service'
import type { DomainEvent } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Re-evaluates the affected customer against every active segment after an
// event has folded into metrics/loyalty. Runs last in the handler chain so it
// sees the updated facts. Skips segment-membership events themselves to avoid a
// re-evaluation loop.

const SKIP_EVENT_TYPES = new Set(['crm.segment_entered', 'crm.segment_exited'])

export async function projectSegments(tx: PrismaClientLike, event: DomainEvent) {
  if (!event.customerId || SKIP_EVENT_TYPES.has(event.eventType)) {
    return
  }

  await evaluateCustomerSegments(tx, event.tenantId, event.customerId, event.occurredAt)
}
