'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createPurchaseReturnServerFn,
  getPurchaseReturnServerFn,
  listPurchaseReturnsServerFn,
  postPurchaseReturnServerFn,
} from '#/features/purchasing/server-functions'
import type { z } from 'zod'
import type { purchaseReturnCreateSchema } from '#/features/purchasing/validation'

export type PurchaseReturnCreateInput = z.infer<
  typeof purchaseReturnCreateSchema
>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view purchase returns.')
  }

  return accessToken
}

// The list server fn takes no filters — the register is filtered client-side.
export function usePurchaseReturns() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['purchase-returns', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listPurchaseReturnsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function usePurchaseReturn(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['purchase-return', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getPurchaseReturnServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

export function usePurchaseReturnMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  // Posting a return issues stock out of the source location, so the stock and
  // movement caches have to fall with the document caches.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-returns', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['purchase-return', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['movements', tenantId] })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing purchase returns.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createPurchaseReturn = useMutation({
    mutationFn: async (input: PurchaseReturnCreateInput) =>
      createPurchaseReturnServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const postPurchaseReturn = useMutation({
    mutationFn: async (id: string) =>
      postPurchaseReturnServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createPurchaseReturn, postPurchaseReturn }
}
