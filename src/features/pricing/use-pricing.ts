'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createPriceListServerFn,
  deletePriceListServerFn,
  deleteProductPriceServerFn,
  listPriceListsServerFn,
  listProductPricesServerFn,
  updatePriceListServerFn,
  upsertProductPriceServerFn,
} from '#/features/pricing/server-functions'
import type {
  PriceListWriteInput,
  ProductPriceFilters,
  ProductPriceWriteInput,
} from '#/features/pricing/validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to manage pricing.')
  }

  return accessToken
}

export function usePriceLists() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['price-lists', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listPriceListsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useProductPrices(filters: ProductPriceFilters = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['product-prices', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listProductPricesServerFn({
        data: { accessToken, tenantId: tenantId as string, filters },
      })
    },
  })
}

export function usePricingMutations() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)
  const queryClient = useQueryClient()

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['price-lists', tenantId] })
    void queryClient.invalidateQueries({
      queryKey: ['product-prices', tenantId],
    })
  }

  const createPriceList = useMutation({
    mutationFn: async (input: PriceListWriteInput) => {
      const accessToken = await requireAccessToken()

      return createPriceListServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
    onSuccess: invalidate,
  })

  const updatePriceList = useMutation({
    mutationFn: async (payload: {
      id: string
      input: Partial<PriceListWriteInput>
    }) => {
      const accessToken = await requireAccessToken()

      return updatePriceListServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          id: payload.id,
          input: payload.input,
        },
      })
    },
    onSuccess: invalidate,
  })

  const deletePriceList = useMutation({
    mutationFn: async (id: string) => {
      const accessToken = await requireAccessToken()

      return deletePriceListServerFn({
        data: { accessToken, tenantId: tenantId as string, id },
      })
    },
    onSuccess: invalidate,
  })

  const upsertProductPrice = useMutation({
    mutationFn: async (input: ProductPriceWriteInput) => {
      const accessToken = await requireAccessToken()

      return upsertProductPriceServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
    onSuccess: invalidate,
  })

  const deleteProductPrice = useMutation({
    mutationFn: async (id: string) => {
      const accessToken = await requireAccessToken()

      return deleteProductPriceServerFn({
        data: { accessToken, tenantId: tenantId as string, id },
      })
    },
    onSuccess: invalidate,
  })

  return {
    createPriceList,
    updatePriceList,
    deletePriceList,
    upsertProductPrice,
    deleteProductPrice,
  }
}
