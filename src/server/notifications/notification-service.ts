import { prisma } from '#/server/db/client'
import * as notificationRepo from '#/server/repos/pod-notification-repo'
import type { NotificationDraft } from '#/server/repos/pod-notification-repo'
import type { CurrentUserContext } from '#/types/auth'
import type { PrismaClientLike } from '#/server/db/types'

// Server-side notification service (Spec 005 Phase 7 — previously a gap).
// Notifications are written in the SAME transaction as the business action
// that triggers them, so an aborted action never leaves phantom alerts.

// Resolve who should be alerted for an approval step: a directly-named
// profile, everyone holding the step's role in the tenant, or (open step)
// nobody targeted — the request still shows in every eligible approver's
// inbox via listMyApprovals.
export async function resolveStepRecipients(
  tenantId: string,
  step: { approverProfileId?: string | null; approverRoleCode?: string | null },
  client: PrismaClientLike = prisma,
): Promise<Array<string>> {
  if (step.approverProfileId) {
    return [step.approverProfileId]
  }

  if (!step.approverRoleCode) {
    return []
  }

  const members = await client.tenantUser.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      roles: { some: { role: { code: step.approverRoleCode } } },
    },
    select: { profileId: true },
  })

  return members.map((member) => member.profileId)
}

// De-duplicates recipients and never notifies the actor about their own action.
export function buildNotificationDrafts(
  recipients: Array<string>,
  actorProfileId: string | null,
  template: Omit<NotificationDraft, 'recipientProfileId'>,
): Array<NotificationDraft> {
  return Array.from(new Set(recipients))
    .filter((profileId) => profileId !== actorProfileId)
    .map((recipientProfileId) => ({ recipientProfileId, ...template }))
}

export async function notify(
  tx: PrismaClientLike,
  tenantId: string,
  recipients: Array<string>,
  actorProfileId: string | null,
  template: Omit<NotificationDraft, 'recipientProfileId'>,
): Promise<void> {
  await notificationRepo.createNotifications(
    tenantId,
    buildNotificationDrafts(recipients, actorProfileId, template),
    tx,
  )
}

// --- Inbox reads/writes ------------------------------------------------------

export function listMyNotifications(
  context: CurrentUserContext,
  tenantId: string,
  options: { unreadOnly?: boolean } = {},
) {
  return notificationRepo.listNotifications(
    tenantId,
    context.profileId,
    options,
  )
}

export function countMyUnread(context: CurrentUserContext, tenantId: string) {
  return notificationRepo.countUnread(tenantId, context.profileId)
}

export async function markNotificationRead(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  await notificationRepo.markRead(tenantId, context.profileId, id)

  return { id }
}

export async function markAllNotificationsRead(
  context: CurrentUserContext,
  tenantId: string,
) {
  const count = await notificationRepo.markAllRead(tenantId, context.profileId)

  return { count }
}
