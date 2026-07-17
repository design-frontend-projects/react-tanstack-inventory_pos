'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createProductServerFn,
  deleteProductServerFn,
  getProductServerFn,
  listProductsPageServerFn,
  updateProductServerFn,
} from '#/features/products/server-functions'
import type { z } from 'zod'
import type {
  productCreateSchema,
  productStatusSchema,
  productTypeSchema,
  productUpdateSchema,
} from '#/features/products/validation'

export type ProductCreateInput = z.infer<typeof productCreateSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>

export interface ProductListFilters {
  search?: string
  categoryId?: string
  brandId?: string
  productType?: z.infer<typeof productTypeSchema>
  status?: z.infer<typeof productStatusSchema>
  take?: number
  skip?: number
}

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view products.')
  }

  return accessToken
}

export function useProductsPage(filters: ProductListFilters = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['products', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listProductsPageServerFn({
        data: { accessToken, tenantId: tenantId as string, filters },
      })
    },
  })
}

export function useProduct(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['product', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getProductServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

// Create / update / delete mutations. Every success invalidates the product
// list queries (prefix match) so all filter variants refresh.
export function useProductMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['products', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['product', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['inventory-analytics', tenantId],
    })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing products.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createProduct = useMutation({
    mutationFn: async (input: ProductCreateInput) =>
      createProductServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateProduct = useMutation({
    mutationFn: async (args: { id: string; input: ProductUpdateInput }) =>
      updateProductServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  const deleteProduct = useMutation({
    mutationFn: async (id: string) =>
      deleteProductServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createProduct, updateProduct, deleteProduct }
}
