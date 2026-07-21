'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createGoodsReceiptServerFn,
  getGoodsReceiptServerFn,
  getPurchaseOrderServerFn,
  listGoodsReceiptsServerFn,
  listPurchaseOrdersServerFn,
  postGoodsReceiptServerFn,
} from '#/features/purchasing/server-functions'
import type { z } from 'zod'
import type { goodsReceiptCreateSchema } from '#/features/purchasing/validation'

export type GoodsReceiptCreateInput = z.infer<typeof goodsReceiptCreateSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view goods receipts.')
  }

  return accessToken
}

// The list server fn takes no filters — the register is filtered client-side.
export function useGoodsReceipts() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['goods-receipts', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listGoodsReceiptsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useGoodsReceipt(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['goods-receipt', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getGoodsReceiptServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

// Purchase orders drive the "receive against a PO" flow: the list feeds the
// reference picker, the detail supplies the lines to prefill.
export function usePurchaseOrdersLookup() {
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

export function usePurchaseOrderDetail(id: string | null) {
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

export function useGoodsReceiptMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  // Posting a receipt moves stock and reconciles the parent PO, so the stock
  // and movement caches have to fall with the document caches.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['goods-receipts', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['goods-receipt', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['movements', tenantId] })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing goods receipts.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createGoodsReceipt = useMutation({
    mutationFn: async (input: GoodsReceiptCreateInput) =>
      createGoodsReceiptServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const postGoodsReceipt = useMutation({
    mutationFn: async (id: string) =>
      postGoodsReceiptServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createGoodsReceipt, postGoodsReceipt }
}
