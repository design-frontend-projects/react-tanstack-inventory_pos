'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createSupplierServerFn,
  deleteSupplierServerFn,
  listSuppliersServerFn,
  listSupplierCategoriesServerFn,
  updateSupplierServerFn,
} from '#/features/suppliers/server-functions'
import type { z } from 'zod'
import type {
  supplierCreateSchema,
  supplierListSchema,
  supplierUpdateSchema,
} from '#/features/suppliers/validation'

export type SupplierListInput = z.infer<typeof supplierListSchema>
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view suppliers.')
  }

  return accessToken
}

export function useSuppliers(input: SupplierListInput = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['suppliers', tenantId, input],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSuppliersServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
  })
}

export function useSupplierCategories() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['supplier-categories', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSupplierCategoriesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

// Create / update / delete mutations. Every success invalidates the supplier
// list queries so the register refreshes without a manual refetch.
export function useSupplierMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['suppliers', tenantId] })

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing suppliers.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createSupplier = useMutation({
    mutationFn: async (input: SupplierCreateInput) =>
      createSupplierServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateSupplier = useMutation({
    mutationFn: async (args: { id: string; input: SupplierUpdateInput }) =>
      updateSupplierServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) =>
      deleteSupplierServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createSupplier, updateSupplier, deleteSupplier }
}
