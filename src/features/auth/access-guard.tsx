"use client"

import type { ReactNode } from 'react'
import {
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
} from '#/features/auth/permissions'

type AccessGuardProps = {
  roles?: Array<string>
  permissions?: Array<string>
  requireAllPermissions?: boolean
  userRoles: Array<string>
  userPermissions: Array<string>
  fallback?: ReactNode
  children: ReactNode
}

export function AccessGuard({
  roles = [],
  permissions = [],
  requireAllPermissions = false,
  userRoles,
  userPermissions,
  fallback = null,
  children,
}: AccessGuardProps) {
  const roleAllowed = roles.length === 0 || hasAnyRole(userRoles, roles)
  const permissionAllowed =
    permissions.length === 0
      ? true
      : requireAllPermissions
        ? hasAllPermissions(userPermissions, permissions)
        : hasAnyPermission(userPermissions, permissions)

  if (!roleAllowed || !permissionAllowed) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
