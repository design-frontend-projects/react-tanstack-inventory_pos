'use client'

import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'

// Shared plumbing for the CRM query hooks.

export async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    throw new Error('You must be signed in to use the CRM.')
  }
  return accessToken
}

export function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export async function crmPayload(tenantId: string | null) {
  if (!tenantId) {
    throw new Error('Select a workspace before using the CRM.')
  }
  return { accessToken: await requireAccessToken(), tenantId }
}
