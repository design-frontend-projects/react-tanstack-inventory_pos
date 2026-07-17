'use client'

import { useQuery } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  getRfqComparisonServerFn,
  listQuotationsServerFn,
  listRfqsServerFn,
} from '#/features/purchasing/sourcing-server-functions'
import type { z } from 'zod'
import type {
  quotationListSchema,
  rfqListSchema,
} from '#/features/purchasing/sourcing-validation'

export type RfqListInput = z.infer<typeof rfqListSchema>
export type QuotationListInput = z.infer<typeof quotationListSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view sourcing documents.')
  }

  return accessToken
}

export function useRfqs(input: RfqListInput = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['rfqs', tenantId, input],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listRfqsServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
  })
}

export function useQuotations(input: QuotationListInput = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['quotations', tenantId, input],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listQuotationsServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
  })
}

export function useRfqComparison(rfqId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['rfq-comparison', tenantId, rfqId],
    enabled: Boolean(tenantId && rfqId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getRfqComparisonServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          id: rfqId as string,
        },
      })
    },
  })
}
