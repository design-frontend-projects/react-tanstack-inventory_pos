'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  getPurchaseReportingSnapshotServerFn,
  refreshPurchaseReportingServerFn,
} from '#/features/purchasing/reporting-server-functions'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view purchasing reports.')
  }

  return accessToken
}

export function usePurchaseReporting() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['purchase-reporting', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getPurchaseReportingSnapshotServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useRefreshPurchaseReporting() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useMutation({
    mutationFn: async () => {
      const accessToken = await requireAccessToken()

      return refreshPurchaseReportingServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['purchase-reporting', tenantId],
      }),
  })
}
