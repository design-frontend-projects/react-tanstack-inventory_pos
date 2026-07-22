'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  expireLotsServerFn,
  listSnapshotsServerFn,
  takeSnapshotServerFn,
} from '#/features/inventory/server-functions'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to manage inventory settings.')
  }

  return accessToken
}

export function useSnapshots(periodKey?: string) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['snapshots', tenantId, periodKey ?? 'all'],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSnapshotsServerFn({
        data: { accessToken, tenantId: tenantId as string, periodKey },
      })
    },
  })
}

export function useInventorySettingsMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before running maintenance tasks.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const takeSnapshot = useMutation({
    mutationFn: async (periodKey: string) =>
      takeSnapshotServerFn({ data: { ...(await payload()), periodKey } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshots', tenantId] })
    },
  })

  const expireLots = useMutation({
    mutationFn: async () => expireLotsServerFn({ data: await payload() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lots', tenantId] })
      void queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
    },
  })

  return { takeSnapshot, expireLots }
}
