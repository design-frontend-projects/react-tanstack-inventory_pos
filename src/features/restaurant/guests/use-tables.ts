'use client'

import { useQuery } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import { listTablesServerFn } from '#/features/restaurant/master-data/server-functions'

// Branch tables for pickers (seating, QR assignment).
export function useTables(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-tables', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listTablesServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
        },
      })
    },
  })
}
