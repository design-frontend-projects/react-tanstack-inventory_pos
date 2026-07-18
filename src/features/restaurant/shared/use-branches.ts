'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import { listBranchesServerFn } from '#/features/restaurant/master-data/server-functions'

export function useRestaurantBranches() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-branches', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listBranchesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

// Branch selection shared by every restaurant screen: defaults to the tenant's
// default (or first) active branch until the user picks another.
export function useBranchSelection() {
  const branchesQuery = useRestaurantBranches()
  const [selectedBranchId, setSelectedBranchId] = React.useState<string | null>(null)

  const branches = branchesQuery.data ?? []
  const fallbackBranch =
    branches.find((branch) => branch.isDefault && branch.isActive) ??
    branches.find((branch) => branch.isActive) ??
    branches.at(0) ??
    null

  const branchId = selectedBranchId ?? fallbackBranch?.id ?? null

  return {
    branches,
    branchId,
    setBranchId: setSelectedBranchId,
    isLoading: branchesQuery.isLoading,
    isError: branchesQuery.isError,
  }
}
