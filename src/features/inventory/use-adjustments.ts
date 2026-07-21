'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createAdjustmentServerFn,
  getAdjustmentServerFn,
  listAdjustmentsServerFn,
  postAdjustmentServerFn,
} from '#/features/inventory/server-functions'
import type { z } from 'zod'
import type { adjustmentCreateSchema } from '#/features/inventory/validation'

export type AdjustmentCreateInput = z.infer<typeof adjustmentCreateSchema>

// The list server fn takes no filter arguments, so narrowing happens client-side
// on the fetched page. Filters stay in the query key to keep each view cached.
export interface AdjustmentFilters {
  status?: string
  warehouseId?: string
  search?: string
}

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view adjustments.')
  }

  return accessToken
}

export function useAdjustments(filters: AdjustmentFilters = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['adjustments', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      const rows = await listAdjustmentsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })

      const search = filters.search?.trim().toLowerCase() ?? ''

      return rows.filter((row) => {
        if (filters.status && row.status !== filters.status) {
          return false
        }
        if (filters.warehouseId && row.warehouseId !== filters.warehouseId) {
          return false
        }
        if (search && !row.documentNumber.toLowerCase().includes(search)) {
          return false
        }
        return true
      })
    },
  })
}

export function useAdjustment(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['adjustment', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getAdjustmentServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

// Posting an adjustment writes stock movements, so every downstream cache
// (stock, ledger, analytics) is invalidated alongside the document lists.
export function useAdjustmentMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['adjustments', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['adjustment', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['movements', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['inventory-analytics', tenantId],
    })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing adjustments.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createAdjustment = useMutation({
    mutationFn: async (input: AdjustmentCreateInput) =>
      createAdjustmentServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const postAdjustment = useMutation({
    mutationFn: async (id: string) =>
      postAdjustmentServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createAdjustment, postAdjustment }
}
