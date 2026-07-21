'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  listSnapshotsServerFn,
  takeSnapshotServerFn,
} from '#/features/inventory/server-functions'

// Valuation, reorder suggestions and every chart series already have hooks in
// use-inventory-analytics.ts — this file only covers the snapshot surface the
// reports workspace adds on top.

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view inventory reports.')
  }

  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useStockSnapshots(periodKey?: string) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['inventory-reports', tenantId, 'snapshots', periodKey],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSnapshotsServerFn({
        data: { accessToken, tenantId: tenantId as string, periodKey },
      })
    },
  })
}

// Materializes the period snapshot. `periodKey` must be YYYY-MM — the server
// function rejects anything else.
export function useTakeSnapshot() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  return useMutation({
    mutationFn: async (periodKey: string) => {
      if (!tenantId) {
        throw new Error('Select a workspace before taking a snapshot.')
      }

      return takeSnapshotServerFn({
        data: { accessToken: await requireAccessToken(), tenantId, periodKey },
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['inventory-reports', tenantId],
      }),
  })
}

// Current period in the YYYY-MM shape the snapshot endpoints validate.
export function currentPeriodKey(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')

  return `${date.getFullYear()}-${month}`
}
