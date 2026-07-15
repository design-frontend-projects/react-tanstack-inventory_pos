"use client"

import { useQuery } from '@tanstack/react-query'
import type { NavigationTree } from '#/types/navigation'
import { getNavigationTreeServerFn } from '#/features/auth/server-functions'
import { withAccessToken } from '#/features/auth/with-access-token'

const NAVIGATION_TREE_QUERY_KEY = ['layout', 'navigation-tree'] as const

export function useNavigationTree(tenantId: string | null) {
  return useQuery<NavigationTree>({
    enabled: !!tenantId,
    queryKey: [...NAVIGATION_TREE_QUERY_KEY, tenantId],
    staleTime: 60_000,
    queryFn: async () =>
      withAccessToken((accessToken) =>
        getNavigationTreeServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
          },
        })
      ),
  })
}
