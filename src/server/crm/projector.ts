import { projectLoyalty } from '#/server/crm/projections/loyalty-projection'
import { projectMetrics } from '#/server/crm/projections/metrics-projection'
import { projectSegments } from '#/server/crm/projections/segment-projection'
import { projectTimeline } from '#/server/crm/projections/timeline-projection'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { DomainEvent } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'
import * as cursorRepo from '#/server/repos/crm-projection-cursor-repo'
import * as domainEventRepo from '#/server/repos/domain-event-repo'
import type { CurrentUserContext } from '#/types/auth'

// The CRM projector: the single consumer of the domain-event outbox. Each
// batch runs in one transaction under a pg advisory xact lock so overlapping
// scheduler ticks cannot double-process; the cursor advances in the same
// transaction as the projections, so a crash replays the batch and every
// handler must be (and is) idempotent. Handlers run in registration order —
// later phases append metrics, loyalty, and segment projections.

const CRM_PROJECTOR_LOCK_KEY = 730_003_001n
const CONSUMER_NAME = 'crm'

export type ProjectionHandler = (
  tx: PrismaClientLike,
  event: DomainEvent
) => Promise<void>

// Order matters: timeline first, then metrics (which segments read), then
// loyalty auto-earn, then segment re-evaluation against the freshest facts.
const HANDLERS: Array<ProjectionHandler> = [
  projectTimeline,
  projectMetrics,
  projectLoyalty,
  projectSegments,
]

export function registerProjectionHandler(handler: ProjectionHandler) {
  if (!HANDLERS.includes(handler)) {
    HANDLERS.push(handler)
  }
}

export interface ProjectorRunResult {
  batches: number
  processed: number
  lastSequence: string
}

export async function runCrmProjector(
  _context: CurrentUserContext,
  options: { batchSize?: number; maxBatches?: number } = {}
): Promise<ProjectorRunResult> {
  const batchSize = Math.min(options.batchSize ?? 500, 1000)
  const maxBatches = Math.min(options.maxBatches ?? 20, 100)

  let batches = 0
  let processed = 0
  let lastSequence = 0n

  for (let index = 0; index < maxBatches; index++) {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CRM_PROJECTOR_LOCK_KEY})`

        const cursor = await cursorRepo.getCursor(CONSUMER_NAME, tx)
        const events = await domainEventRepo.listEventsAfter(cursor, batchSize, tx)

        if (events.length === 0) {
          return { count: 0, lastSequence: cursor }
        }

        for (const event of events) {
          for (const handler of HANDLERS) {
            await handler(tx, event)
          }
        }

        const batchLast = events[events.length - 1].id
        await cursorRepo.advanceCursor(CONSUMER_NAME, batchLast, tx)

        return { count: events.length, lastSequence: batchLast }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
    )

    lastSequence = result.lastSequence
    processed += result.count

    if (result.count === 0) {
      break
    }

    batches += 1
  }

  return { batches, processed, lastSequence: lastSequence.toString() }
}
