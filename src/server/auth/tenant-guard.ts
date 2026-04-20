import { hasAnyPermission, hasAnyRole } from '#/features/auth/permissions'
import type { CurrentUserContext } from '#/types/auth'
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '#/server/auth/errors'

export function requireAuth(context: CurrentUserContext | null | undefined) {
  if (!context) {
    throw new UnauthorizedError()
  }

  return context
}

export function requireTenantAccess(
  context: CurrentUserContext | null | undefined,
  tenantId: string
) {
  const resolvedContext = requireAuth(context)

  if (!resolvedContext.activeTenantId || resolvedContext.activeTenantId !== tenantId) {
    throw new ForbiddenError('You do not have access to this tenant.')
  }

  if (!resolvedContext.tenantUserId) {
    throw new ForbiddenError('Tenant access is not available for this user.')
  }

  if (resolvedContext.tenantStatus !== 'active') {
    throw new ForbiddenError('Your tenant access is not currently active.')
  }

  return resolvedContext
}

export function requireRole(
  context: CurrentUserContext | null | undefined,
  roleCodes: Array<string>
) {
  const resolvedContext = requireAuth(context)

  if (!roleCodes.length) {
    throw new ValidationError('At least one role is required.')
  }

  if (!hasAnyRole(resolvedContext.roles, roleCodes)) {
    throw new ForbiddenError('The required role is missing.')
  }

  return resolvedContext
}

export function requirePermission(
  context: CurrentUserContext | null | undefined,
  permissionCodes: Array<string> | string
) {
  const resolvedContext = requireAuth(context)
  const requiredPermissions = Array.isArray(permissionCodes)
    ? permissionCodes
    : [permissionCodes]

  if (!requiredPermissions.length) {
    throw new ValidationError('At least one permission is required.')
  }

  if (!hasAnyPermission(resolvedContext.permissions, requiredPermissions)) {
    throw new ForbiddenError('The required permission is missing.')
  }

  return resolvedContext
}
