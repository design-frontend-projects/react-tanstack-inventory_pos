'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  approveStockCountServerFn,
  cancelStockCountServerFn,
  createStockCountServerFn,
  getStockCountServerFn,
  listStockCountsServerFn,
  recordStockCountServerFn,
  reviewStockCountServerFn,
  startStockCountServerFn,
} from '#/features/inventory/counts/server-functions'
import type {
  StockCountCreateInput,
  StockCountEntryInput,
} from '#/features/inventory/counts/count-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view stock counts.')
  }

  return accessToken
}

export function useStockCounts() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['stock-counts', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listStockCountsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useStockCount(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['stock-count', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getStockCountServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

// Approving a count posts a stock adjustment, so every mutation also refreshes
// the stock, movement and adjustment views.
export function useStockCountMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    for (const key of [
      'stock-counts',
      'stock-count',
      'adjustments',
      'stock',
      'movements',
      'inventory-analytics',
    ]) {
      queryClient.invalidateQueries({ queryKey: [key, tenantId] })
    }
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing stock counts.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createStockCount = useMutation({
    mutationFn: async (input: StockCountCreateInput) =>
      createStockCountServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const startStockCount = useMutation({
    mutationFn: async (id: string) =>
      startStockCountServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const recordCounts = useMutation({
    mutationFn: async (args: {
      id: string
      entries: Array<StockCountEntryInput>
    }) =>
      recordStockCountServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { entries: args.entries },
        },
      }),
    onSuccess: invalidate,
  })

  const reviewStockCount = useMutation({
    mutationFn: async (id: string) =>
      reviewStockCountServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const approveStockCount = useMutation({
    mutationFn: async (id: string) =>
      approveStockCountServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const cancelStockCount = useMutation({
    mutationFn: async (id: string) =>
      cancelStockCountServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return {
    createStockCount,
    startStockCount,
    recordCounts,
    reviewStockCount,
    approveStockCount,
    cancelStockCount,
  }
}
