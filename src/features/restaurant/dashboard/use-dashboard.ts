'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  getRestaurantAnalyticsServerFn,
  getRestaurantDashboardServerFn,
  getRestaurantItemsReportServerFn,
  getRestaurantSalesReportServerFn,
} from '#/features/restaurant/dashboard/server-functions'

// Locale-correct day boundaries: "today" and "N days back" are computed in the
// browser's timezone and sent to the server as ISO instants.
export function useTodayRange(): { from: string; to: string } {
  return React.useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { from: start.toISOString(), to: end.toISOString() }
  }, [])
}

export function useDaysRange(days: number): { from: string; to: string } {
  return React.useMemo(() => {
    const end = new Date()
    end.setHours(0, 0, 0, 0)
    end.setDate(end.getDate() + 1)
    const start = new Date(end)
    start.setDate(start.getDate() - days)
    return { from: start.toISOString(), to: end.toISOString() }
  }, [days])
}

interface RangeInput {
  branchId?: string
  from: string
  to: string
}

export function useRestaurantDashboard(input: RangeInput | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-dashboard', tenantId, input],
    enabled: Boolean(tenantId) && Boolean(input),
    refetchInterval: 60_000,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getRestaurantDashboardServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          input: input as RangeInput,
        },
      })
    },
  })
}

export function useRestaurantAnalytics(input: RangeInput | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-analytics', tenantId, input],
    enabled: Boolean(tenantId) && Boolean(input),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getRestaurantAnalyticsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          input: input as RangeInput,
        },
      })
    },
  })
}

export function useRestaurantSalesReport(input: RangeInput | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-sales-report', tenantId, input],
    enabled: Boolean(tenantId) && Boolean(input),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getRestaurantSalesReportServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          input: input as RangeInput,
        },
      })
    },
  })
}

export function useRestaurantItemsReport(input: RangeInput | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-items-report', tenantId, input],
    enabled: Boolean(tenantId) && Boolean(input),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getRestaurantItemsReportServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          input: input as RangeInput,
        },
      })
    },
  })
}
