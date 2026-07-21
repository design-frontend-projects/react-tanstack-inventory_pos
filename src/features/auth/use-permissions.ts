'use client'

import * as React from 'react'

import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
} from '#/features/auth/permissions'

export interface PermissionsApi {
  permissions: Array<string>
  roles: Array<string>
  tenantId: string | null
  isLoading: boolean
  // True when the actor holds ANY of the supplied codes (empty list = allowed).
  can: (codes: Array<string>) => boolean
  // True when the actor holds EVERY supplied code.
  canAll: (codes: Array<string>) => boolean
  hasRole: (codes: Array<string>) => boolean
}

// Convenience wrapper over useSessionBootstrap so screens can gate individual
// buttons/fields without repeating the `session.context?.permissions ?? []`
// boilerplate. AccessGuard remains the tool for gating whole subtrees.
export function usePermissions(): PermissionsApi {
  const session = useSessionBootstrap()
  const permissions = React.useMemo(
    () => session.context?.permissions ?? [],
    [session.context],
  )
  const roles = React.useMemo(
    () => session.context?.roles ?? [],
    [session.context],
  )

  return React.useMemo(
    () => ({
      permissions,
      roles,
      tenantId: session.activeTenantId ?? null,
      isLoading: session.isLoading,
      can: (codes) =>
        codes.length === 0 || hasAnyPermission(permissions, codes),
      canAll: (codes) =>
        codes.length === 0 || hasAllPermissions(permissions, codes),
      hasRole: (codes) => codes.length === 0 || hasAnyRole(roles, codes),
    }),
    [permissions, roles, session.activeTenantId, session.isLoading],
  )
}
