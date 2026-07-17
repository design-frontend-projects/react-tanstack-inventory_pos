'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createBrandServerFn,
  createCategoryServerFn,
  createUomServerFn,
  deleteBrandServerFn,
  deleteCategoryServerFn,
  listBrandsServerFn,
  listCategoriesServerFn,
  listSuppliersServerFn,
  listTaxRatesServerFn,
  listUomsServerFn,
  updateBrandServerFn,
  updateCategoryServerFn,
  updateUomServerFn,
} from '#/features/products/server-functions'
import type { z } from 'zod'
import type {
  brandWriteSchema,
  categoryWriteSchema,
  uomWriteSchema,
} from '#/features/products/validation'

export type BrandWriteInput = z.infer<typeof brandWriteSchema>
export type CategoryWriteInput = z.infer<typeof categoryWriteSchema>
export type UomWriteInput = z.infer<typeof uomWriteSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view catalog master data.')
  }

  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useBrands() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['brands', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listBrandsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useCategories() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['categories', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listCategoriesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useUoms() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['uoms', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listUomsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useTaxRates() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['tax-rates', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listTaxRatesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

// Flat supplier lookup for the preferred-supplier select (catalog slice, not
// the purchasing workspace's paginated register).
export function useSuppliersLookup() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['suppliers-lookup', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSuppliersServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useMasterDataMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = (key: 'brands' | 'categories' | 'uoms') => () => {
    queryClient.invalidateQueries({ queryKey: [key, tenantId] })
    queryClient.invalidateQueries({ queryKey: ['products', tenantId] })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing master data.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createBrand = useMutation({
    mutationFn: async (input: BrandWriteInput) =>
      createBrandServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate('brands'),
  })

  const updateBrand = useMutation({
    mutationFn: async (args: { id: string; input: Partial<BrandWriteInput> }) =>
      updateBrandServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate('brands'),
  })

  const deleteBrand = useMutation({
    mutationFn: async (id: string) =>
      deleteBrandServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate('brands'),
  })

  const createCategory = useMutation({
    mutationFn: async (input: CategoryWriteInput) =>
      createCategoryServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate('categories'),
  })

  const updateCategory = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<CategoryWriteInput>
    }) =>
      updateCategoryServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate('categories'),
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) =>
      deleteCategoryServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate('categories'),
  })

  const createUom = useMutation({
    mutationFn: async (input: UomWriteInput) =>
      createUomServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate('uoms'),
  })

  const updateUom = useMutation({
    mutationFn: async (args: { id: string; input: Partial<UomWriteInput> }) =>
      updateUomServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate('uoms'),
  })

  return {
    createBrand,
    updateBrand,
    deleteBrand,
    createCategory,
    updateCategory,
    deleteCategory,
    createUom,
    updateUom,
  }
}
