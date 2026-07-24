'use client'

import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'

// Shared plumbing for the finance query hooks, mirroring use-crm-base.

export async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    throw new Error('You must be signed in to use Financial Management.')
  }
  return accessToken
}

export function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export async function financePayload(tenantId: string | null) {
  if (!tenantId) {
    throw new Error('Select a workspace before using Financial Management.')
  }
  return { accessToken: await requireAccessToken(), tenantId }
}
