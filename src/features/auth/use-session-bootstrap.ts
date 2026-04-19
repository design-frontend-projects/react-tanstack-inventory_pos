"use client"

import * as React from 'react'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import type { SessionUser, WorkspaceMembership } from '#/types/app'

const SESSION_USER: SessionUser = {
  id: 'user-amina-khaled',
  displayName: 'Amina Khaled',
  email: 'amina@meridian.demo',
  title: 'Group Operations Director',
}

const MEMBERSHIPS: WorkspaceMembership[] = [
  {
    tenantId: 'meridian-foods',
    tenantName: 'Meridian Foods Group',
    role: 'owner',
    regionLabel: 'Cairo + Giza Cluster',
    defaultOutletLabel: 'Kasr El Nil Flagship',
  },
  {
    tenantId: 'atlas-kitchens',
    tenantName: 'Atlas Kitchens',
    role: 'manager',
    regionLabel: 'Alexandria + North Coast',
    defaultOutletLabel: 'Corniche Hot Line',
  },
  {
    tenantId: 'night-shift-labs',
    tenantName: 'Night Shift Labs',
    role: 'admin',
    regionLabel: 'Sandbox Workspace',
    defaultOutletLabel: 'Remote Test Counter',
  },
]

export function useSessionBootstrap() {
  const activeTenantId = usePreferencesStore((state) => state.activeTenantId)
  const setActiveTenantId = usePreferencesStore(
    (state) => state.setActiveTenantId
  )

  React.useEffect(() => {
    if (!activeTenantId) {
      setActiveTenantId(MEMBERSHIPS[0].tenantId)
    }
  }, [activeTenantId, setActiveTenantId])

  const activeMembership =
    MEMBERSHIPS.find((membership) => membership.tenantId === activeTenantId) ??
    MEMBERSHIPS[0]

  return {
    user: SESSION_USER,
    memberships: MEMBERSHIPS,
    activeMembership,
    setActiveTenantId,
  }
}
