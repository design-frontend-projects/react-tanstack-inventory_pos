'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  approvePurchaseOrderServerFn,
  cancelPurchaseOrderServerFn,
  confirmPurchaseOrderServerFn,
  createPurchaseOrderServerFn,
  getPurchaseOrderServerFn,
  listPurchaseOrdersServerFn,
} from '#/features/purchasing/server-functions'
import type { z } from 'zod'
import type { purchaseOrderCreateSchema } from '#/features/purchasing/validation'

export type PurchaseOrderCreateInput = z.infer<typeof purchaseOrderCreateSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view purchase orders.')
  }

  return accessToken
}

// The list server fn takes no filters — the register filters client-side.
export function usePurchaseOrders() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['purchase-orders', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listPurchaseOrdersServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function usePurchaseOrder(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['purchase-order', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getPurchaseOrderServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

// Lifecycle mutations. Requisition-sourced orders change the requisition's
// converted state, so the requisition register is refreshed alongside.
export function usePurchaseOrderMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['purchase-order', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['requisitions', tenantId] })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing purchase orders.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createPurchaseOrder = useMutation({
    mutationFn: async (input: PurchaseOrderCreateInput) =>
      createPurchaseOrderServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const approvePurchaseOrder = useMutation({
    mutationFn: async (id: string) =>
      approvePurchaseOrderServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const confirmPurchaseOrder = useMutation({
    mutationFn: async (id: string) =>
      confirmPurchaseOrderServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const cancelPurchaseOrder = useMutation({
    mutationFn: async (id: string) =>
      cancelPurchaseOrderServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return {
    createPurchaseOrder,
    approvePurchaseOrder,
    confirmPurchaseOrder,
    cancelPurchaseOrder,
  }
}
