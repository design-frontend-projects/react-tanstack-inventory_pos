"use client"

import { useQuery } from '@tanstack/react-query'
import type { ActivityOption } from '#/types/owner'
import { listActivityOptionsServerFn } from '#/features/auth/server-functions'
import { ACTIVITY_OPTION_DEFINITIONS } from '#/features/owner/owner-catalog'

const ACTIVITY_OPTIONS_QUERY_KEY = ['owner', 'activity-options'] as const

// Static fallback so the public sign-up page always has options to render, even
// before/if the DB-backed list resolves.
const FALLBACK_ACTIVITY_OPTIONS: Array<ActivityOption> =
  ACTIVITY_OPTION_DEFINITIONS.map((definition) => ({
    code: definition.code,
    name: definition.name,
    nameAr: definition.nameAr,
  }))

export function useActivityOptions() {
  return useQuery<Array<ActivityOption>>({
    queryKey: ACTIVITY_OPTIONS_QUERY_KEY,
    staleTime: 5 * 60_000,
    initialData: FALLBACK_ACTIVITY_OPTIONS,
    queryFn: async () => {
      const options = await listActivityOptionsServerFn()
      return options.length > 0 ? options : FALLBACK_ACTIVITY_OPTIONS
    },
  })
}
