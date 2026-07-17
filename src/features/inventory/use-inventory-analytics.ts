'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  inventoryKpisServerFn,
  movementTrendServerFn,
  stockByCategoryServerFn,
  topProductsByValueServerFn,
  warehouseSummariesServerFn,
} from '#/features/inventory/analytics-server-functions'
import {
  deleteReorderRuleServerFn,
  listReorderRulesServerFn,
  reorderSuggestionsServerFn,
  upsertReorderRuleServerFn,
  valuationSummaryServerFn,
} from '#/features/inventory/server-functions'

export interface ReorderRuleInput {
  productId: string
  variantId?: string | null
  warehouseId: string
  minStock?: number | string
  maxStock?: number | string
  safetyStock?: number | string
  reorderPoint?: number | string
  reorderQty?: number | string
  economicOrderQty?: number | string | null
  leadTimeDays?: number | null
  preferredSupplierId?: string | null
  isActive?: boolean
  notes?: string | null
}

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view inventory analytics.')
  }

  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useInventoryKpis() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['inventory-analytics', tenantId, 'kpis'],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return inventoryKpisServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useStockByCategory(warehouseId?: string) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: [
      'inventory-analytics',
      tenantId,
      'stock-by-category',
      warehouseId,
    ],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return stockByCategoryServerFn({
        data: { accessToken, tenantId: tenantId as string, warehouseId },
      })
    },
  })
}

export function useTopProductsByValue(limit?: number) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['inventory-analytics', tenantId, 'top-products', limit],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return topProductsByValueServerFn({
        data: { accessToken, tenantId: tenantId as string, limit },
      })
    },
  })
}

export function useMovementTrend(
  options: { warehouseId?: string; days?: number } = {},
) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['inventory-analytics', tenantId, 'movement-trend', options],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return movementTrendServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          warehouseId: options.warehouseId,
          days: options.days,
        },
      })
    },
  })
}

export function useWarehouseSummaries() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['inventory-analytics', tenantId, 'warehouse-summaries'],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return warehouseSummariesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useValuationSummary(warehouseId?: string) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['inventory-analytics', tenantId, 'valuation', warehouseId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return valuationSummaryServerFn({
        data: { accessToken, tenantId: tenantId as string, warehouseId },
      })
    },
  })
}

export function useReorderSuggestions(warehouseId?: string) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: [
      'inventory-analytics',
      tenantId,
      'reorder-suggestions',
      warehouseId,
    ],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return reorderSuggestionsServerFn({
        data: { accessToken, tenantId: tenantId as string, warehouseId },
      })
    },
  })
}

export function useReorderRules() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['inventory-analytics', tenantId, 'reorder-rules'],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listReorderRulesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useReorderRuleMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['inventory-analytics', tenantId],
    })

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing reorder rules.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const upsertReorderRule = useMutation({
    mutationFn: async (input: ReorderRuleInput) =>
      upsertReorderRuleServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const deleteReorderRule = useMutation({
    mutationFn: async (id: string) =>
      deleteReorderRuleServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { upsertReorderRule, deleteReorderRule }
}
