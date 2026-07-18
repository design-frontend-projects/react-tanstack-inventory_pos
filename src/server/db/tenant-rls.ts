import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'

// Defense-in-depth RLS helper (Spec 005 Phase 7).
//
// The pod_* tables carry ENABLE (not FORCE) row-level-security policies keyed
// on the `app.current_tenant_id` GUC. The app's pooled Prisma connection runs
// as the table owner and BYPASSES them — app-level tenant scoping (guards +
// tenant-filtered repos) remains the primary boundary. This wrapper exists for
// code paths that should ALSO be constrained at the database layer (e.g. a
// future non-owner reporting role, or ad-hoc raw SQL): it opens a transaction,
// sets the GUC with SET LOCAL semantics (`is_local = true`, so the setting
// dies with the transaction and can never leak across pooled connections),
// and runs the callback inside that transaction.

export function withTenantRls<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`

    return fn(tx)
  })
}
