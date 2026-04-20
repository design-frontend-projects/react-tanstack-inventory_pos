import type { Prisma } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'

export async function createAuditLog(input: {
  tenantId?: string | null
  actorProfileId?: string | null
  actionKey: string
  entityType: string
  entityId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      actorProfileId: input.actorProfileId ?? null,
      actionKey: input.actionKey,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValues: (input.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: (input.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}
