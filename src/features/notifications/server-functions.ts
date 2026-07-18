import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as notificationService from '#/server/notifications/notification-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'

// Notifications are personal — any active tenant member can read and manage
// THEIR OWN inbox, so the guard chain stops at tenant access (the repo scopes
// every query by the caller's profile id).

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})

async function resolveMember(data: {
  accessToken: string
  tenantId: string
}): Promise<CurrentUserContext> {
  return requireTenantAccess(
    await getCurrentUserContext({
      accessToken: data.accessToken,
      tenantId: data.tenantId,
    }),
    data.tenantId,
  )
}

export const listMyNotificationsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ unreadOnly: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveMember(data)

    const [notifications, unreadCount] = await Promise.all([
      notificationService.listMyNotifications(context, data.tenantId, {
        unreadOnly: data.unreadOnly,
      }),
      notificationService.countMyUnread(context, data.tenantId),
    ])

    return { notifications, unreadCount }
  })

export const markNotificationReadServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveMember(data)

    return notificationService.markNotificationRead(
      context,
      data.tenantId,
      data.id,
    )
  })

export const markAllNotificationsReadServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveMember(data)

    return notificationService.markAllNotificationsRead(context, data.tenantId)
  })
