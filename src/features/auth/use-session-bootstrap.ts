"use client"

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bootstrapSessionServerFn,
  switchActiveTenantServerFn,
} from '#/features/auth/server-functions'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'
import type { SessionBootstrapPayload } from '#/types/auth'

const SESSION_BOOTSTRAP_QUERY_KEY = ['auth', 'session-bootstrap'] as const

async function fetchSessionBootstrap(
  requestedTenantId?: string | null
): Promise<SessionBootstrapPayload> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    return {
      authenticated: false,
      user: null,
      memberships: [],
      activeTenantId: null,
      activeMembership: null,
      context: null,
      completionFlow: null,
    }
  }

  return bootstrapSessionServerFn({
    data: {
      accessToken,
      requestedTenantId: requestedTenantId ?? null,
    },
  })
}

export function useSessionBootstrap() {
  const queryClient = useQueryClient()
  const activeTenantId = usePreferencesStore((state) => state.activeTenantId)
  const setLocalActiveTenantId = usePreferencesStore(
    (state) => state.setActiveTenantId
  )
  const clearPreferences = usePreferencesStore((state) => state.clear)

  const sessionQuery = useQuery({
    queryKey: [...SESSION_BOOTSTRAP_QUERY_KEY, activeTenantId],
    queryFn: () => fetchSessionBootstrap(activeTenantId),
  })
  const session = sessionQuery.data

  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error('You must be signed in to switch tenants.')
      }

      return switchActiveTenantServerFn({
        data: {
          accessToken,
          tenantId,
        },
      })
    },
    onSuccess: (nextSession) => {
      if (nextSession.activeTenantId) {
        setLocalActiveTenantId(nextSession.activeTenantId)
      }

      queryClient.setQueryData(
        [...SESSION_BOOTSTRAP_QUERY_KEY, nextSession.activeTenantId],
        nextSession
      )
      queryClient.invalidateQueries({
        queryKey: SESSION_BOOTSTRAP_QUERY_KEY,
      })
    },
  })

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({
        queryKey: SESSION_BOOTSTRAP_QUERY_KEY,
      })
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  React.useEffect(() => {
    if (sessionQuery.data?.activeTenantId) {
      setLocalActiveTenantId(sessionQuery.data.activeTenantId)
    }
  }, [sessionQuery.data?.activeTenantId, setLocalActiveTenantId])

  const clearSessionState = React.useCallback(() => {
    clearPreferences()
    queryClient.removeQueries({
      queryKey: SESSION_BOOTSTRAP_QUERY_KEY,
    })
  }, [clearPreferences, queryClient])

  const needsAccountCompletion =
    session?.authenticated === true &&
    session.user !== null &&
    (!session.user.profileCompleted ||
      !session.user.onboardingCompleted ||
      session.activeMembership?.status === 'invited')

  return {
    ...sessionQuery,
    user: session?.user ?? null,
    memberships: session?.memberships ?? [],
    activeMembership: session?.activeMembership ?? null,
    activeTenantId: session?.activeTenantId ?? null,
    context: session?.context ?? null,
    completionFlow: session?.completionFlow ?? null,
    isAuthenticated: session?.authenticated ?? false,
    needsTenantSelection:
      (session?.authenticated ?? false) &&
      (session?.memberships.length ?? 0) > 1 &&
      !session?.activeTenantId,
    needsAccountCompletion,
    needsProfileCompletion: needsAccountCompletion,
    setActiveTenantId: async (tenantId: string) => {
      await switchTenantMutation.mutateAsync(tenantId)
    },
    isSwitchingTenant: switchTenantMutation.isPending,
    clearSessionState,
  }
}
