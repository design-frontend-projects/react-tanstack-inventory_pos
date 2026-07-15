import { earnPointsFromEvent } from '#/server/crm/loyalty-service'
import type { DomainEvent } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Auto-earn: completed sales fold into EARN ledger entries. Idempotent via the
// ledger's unique sourceEventId.

export async function projectLoyalty(tx: PrismaClientLike, event: DomainEvent) {
  await earnPointsFromEvent(tx, event)
}
