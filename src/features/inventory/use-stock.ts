'use client'

import { useQuery } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  getProductStockSummaryServerFn,
  listMovementsServerFn,
  listStockServerFn,
} from '#/features/inventory/server-functions'
import type { z } from 'zod'
import type {
  movementFilterSchema,
  stockFilterSchema,
} from '#/features/inventory/validation'

export type StockFilterInput = z.infer<typeof stockFilterSchema>
export type MovementFilterInput = z.infer<typeof movementFilterSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view stock.')
  }

  return accessToken
}

export function useStock(filters: StockFilterInput = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['stock', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listStockServerFn({
        data: { accessToken, tenantId: tenantId as string, filters },
      })
    },
  })
}

export function useMovements(filters: MovementFilterInput = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['movements', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listMovementsServerFn({
        data: { accessToken, tenantId: tenantId as string, filters },
      })
    },
  })
}

export function useProductStockSummary(productId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['product-stock-summary', tenantId, productId],
    enabled: Boolean(tenantId) && Boolean(productId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getProductStockSummaryServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          productId: productId as string,
        },
      })
    },
  })
}
