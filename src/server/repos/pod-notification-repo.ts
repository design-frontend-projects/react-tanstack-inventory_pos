import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface NotificationDraft {
  recipientProfileId: string
  eventType: string
  title: string
  body?: string | null
  entityType?: string | null
  entityId?: string | null
}

export async function createNotifications(
  tenantId: string,
  drafts: Array<NotificationDraft>,
  client: PrismaClientLike = prisma,
) {
  if (drafts.length === 0) {
    return
  }

  await client.podNotification.createMany({
    data: drafts.map((draft) => ({
      tenantId,
      recipientProfileId: draft.recipientProfileId,
      eventType: draft.eventType,
      title: draft.title,
      body: draft.body ?? null,
      entityType: draft.entityType ?? null,
      entityId: draft.entityId ?? null,
    })),
  })
}

export function listNotifications(
  tenantId: string,
  recipientProfileId: string,
  options: { unreadOnly?: boolean; take?: number } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podNotification.findMany({
    where: {
      tenantId,
      recipientProfileId,
      ...(options.unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options.take ?? 50,
  })
}

export function countUnread(
  tenantId: string,
  recipientProfileId: string,
  client: PrismaClientLike = prisma,
) {
  return client.podNotification.count({
    where: { tenantId, recipientProfileId, isRead: false },
  })
}

// Recipient-scoped: a user can only mark their own notifications.
export async function markRead(
  tenantId: string,
  recipientProfileId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podNotification.updateMany({
    where: { id, tenantId, recipientProfileId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })

  return result.count > 0
}

export async function markAllRead(
  tenantId: string,
  recipientProfileId: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podNotification.updateMany({
    where: { tenantId, recipientProfileId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })

  return result.count
}
