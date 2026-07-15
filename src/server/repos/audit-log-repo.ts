import type { Prisma } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'

export async function createAuditLog(input: {
  tenantId?: string | null
  actorProfileId?: string | null
  actorEmail?: string | null
  actionKey: string
  entityType: string
  entityId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  correlationId?: string | null
}) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      actorProfileId: input.actorProfileId ?? null,
      actorEmail: input.actorEmail ?? null,
      actionKey: input.actionKey,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValues: (input.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: (input.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      correlationId: input.correlationId ?? null,
    },
  })
}

export async function listRecentAuditLogs(tenantId: string, limit = 12) {
  return prisma.auditLog.findMany({
    where: {
      tenantId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    select: {
      id: true,
      actionKey: true,
      entityType: true,
      entityId: true,
      actorEmail: true,
      createdAt: true,
    },
  })
}
