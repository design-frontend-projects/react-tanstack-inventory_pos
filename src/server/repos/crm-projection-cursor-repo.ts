import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Global (cross-tenant) consumer state for outbox projectors: one row per
// consumer name, tracking the last processed `domain_events.id`.

export async function getCursor(
  consumerName: string,
  client: PrismaClientLike = prisma
): Promise<bigint> {
  const cursor = await client.crmProjectionCursor.findUnique({
    where: { consumerName },
  })

  return cursor?.lastSequence ?? 0n
}

export async function advanceCursor(
  consumerName: string,
  lastSequence: bigint,
  client: PrismaClientLike = prisma
) {
  await client.crmProjectionCursor.upsert({
    where: { consumerName },
    create: { consumerName, lastSequence },
    update: { lastSequence },
  })
}
