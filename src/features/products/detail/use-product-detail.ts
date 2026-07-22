'use client'

import { useQuery } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  listLotsServerFn,
  listSerialsServerFn,
} from '#/features/inventory/server-functions'

// Lot/serial reads for the product detail screen. The list server functions take
// no filters, so the tenant-wide result is cached once per tenant and narrowed
// to the current product client-side via `select`.

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view stock.')
  }

  return accessToken
}

export function useProductLots(productId: string, enabled = true) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['lots', tenantId],
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listLotsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
    select: (lots) => lots.filter((lot) => lot.productId === productId),
  })
}

export function useProductSerials(productId: string, enabled = true) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['serials', tenantId],
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listSerialsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
    select: (serials) =>
      serials.filter((serial) => serial.productId === productId),
  })
}
