import { ConflictError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Lookup-table state machine for the Spec-005 pod_* documents. Unlike the
// enum-based `state-machine.ts` used by the Spec-002 spine, allowed transitions
// live in `pod_status_transitions` (global rows with tenant_id NULL, plus
// tenant-scoped rows that ADD to the global set), so admins can customise
// lifecycles without a code change.

export interface TransitionRow {
  fromCode: string
  toCode: string
}

// Pure core — unit-testable without a database.
export function isTransitionAllowed(
  rows: Array<TransitionRow>,
  fromCode: string,
  toCode: string,
): boolean {
  return rows.some((row) => row.fromCode === fromCode && row.toCode === toCode)
}

export async function loadTransitions(
  tenantId: string,
  entityType: string,
  client: PrismaClientLike = prisma,
): Promise<Array<TransitionRow>> {
  return client.podStatusTransition.findMany({
    where: {
      entityType,
      OR: [{ tenantId }, { tenantId: null }],
    },
    select: { fromCode: true, toCode: true },
  })
}

export async function assertPodTransition(
  tenantId: string,
  entityType: string,
  fromCode: string,
  toCode: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const rows = await loadTransitions(tenantId, entityType, client)

  if (!isTransitionAllowed(rows, fromCode, toCode)) {
    throw new ConflictError(
      `Cannot move ${entityType} from "${fromCode}" to "${toCode}".`,
    )
  }
}
