'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  expireReservationsServerFn,
  listReservationsServerFn,
} from '#/features/inventory/server-functions'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view reservations.')
  }

  return accessToken
}

export function useReservations() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['reservations', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listReservationsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useReservationMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing reservations.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['reservations', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
  }

  const expireReservations = useMutation({
    mutationFn: async () =>
      expireReservationsServerFn({ data: await payload() }),
    onSuccess: invalidate,
  })

  return { expireReservations }
}
