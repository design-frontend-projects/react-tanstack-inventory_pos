'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  listMyNotificationsServerFn,
  markAllNotificationsReadServerFn,
  markNotificationReadServerFn,
} from '#/features/notifications/server-functions'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view notifications.')
  }

  return accessToken
}

export function useMyNotifications(options: { unreadOnly?: boolean } = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['notifications', tenantId, options],
    enabled: Boolean(tenantId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listMyNotificationsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          unreadOnly: options.unreadOnly,
        },
      })
    },
  })
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications', tenantId] })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const accessToken = await requireAccessToken()

      return markNotificationReadServerFn({
        data: { accessToken, tenantId: tenantId as string, id },
      })
    },
    onSuccess: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const accessToken = await requireAccessToken()

      return markAllNotificationsReadServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
    onSuccess: invalidate,
  })

  return { markRead, markAllRead }
}
