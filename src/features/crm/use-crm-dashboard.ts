'use client'

import { useQuery } from '@tanstack/react-query'
import { getCrmDashboardServerFn } from '#/features/crm/server-functions'
import { requireAccessToken, useTenantId } from '#/features/crm/use-crm-base'

export type CrmDashboard = Awaited<ReturnType<typeof getCrmDashboardServerFn>>

export function useCrmDashboard(churnThreshold?: number) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-dashboard', tenantId, churnThreshold ?? 0.7],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getCrmDashboardServerFn({
        data: { accessToken, tenantId: tenantId as string, churnThreshold },
      })
    },
  })
}
