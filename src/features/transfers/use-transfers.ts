'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createTransferServerFn,
  getTransferServerFn,
  listTransfersServerFn,
  receiveTransferServerFn,
  shipTransferServerFn,
} from '#/features/transfers/server-functions'
import type { z } from 'zod'
import type { transferCreateSchema } from '#/features/transfers/validation'

export type TransferCreateInput = z.infer<typeof transferCreateSchema>

// The list server fn takes no filter arguments, so narrowing happens client-side
// on the fetched page. Filters stay in the query key to keep each view cached.
export interface TransferFilters {
  status?: string
  warehouseId?: string
  search?: string
}

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view transfers.')
  }

  return accessToken
}

export function useTransfers(filters: TransferFilters = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['transfers', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      const rows = await listTransfersServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })

      const search = filters.search?.trim().toLowerCase() ?? ''

      return rows.filter((row) => {
        if (filters.status && row.status !== filters.status) {
          return false
        }
        // A warehouse filter matches either leg of the move.
        if (
          filters.warehouseId &&
          row.fromWarehouseId !== filters.warehouseId &&
          row.toWarehouseId !== filters.warehouseId
        ) {
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

export function useTransfer(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['transfer', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getTransferServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

// Shipping and receiving both post stock movements, so the stock, ledger and
// analytics caches are invalidated alongside the document lists.
export function useTransferMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transfers', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['transfer', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['movements', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['inventory-analytics', tenantId],
    })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing transfers.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createTransfer = useMutation({
    mutationFn: async (input: TransferCreateInput) =>
      createTransferServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const shipTransfer = useMutation({
    mutationFn: async (id: string) =>
      shipTransferServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const receiveTransfer = useMutation({
    mutationFn: async (id: string) =>
      receiveTransferServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createTransfer, shipTransfer, receiveTransfer }
}
