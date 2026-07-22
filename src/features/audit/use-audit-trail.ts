'use client'

import { useQuery } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { listEntityAuditTrailServerFn } from '#/features/audit/server-functions'

export function useEntityAuditTrail(
  entityType: string,
  entityId: string | null,
  limit = 50,
) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['audit-trail', tenantId, entityType, entityId, limit],
    enabled: Boolean(tenantId) && Boolean(entityId),
    queryFn: async () => {
      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error('You must be signed in to view activity.')
      }

      return listEntityAuditTrailServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          entityType,
          entityId: entityId as string,
          limit,
        },
      })
    },
  })
}
