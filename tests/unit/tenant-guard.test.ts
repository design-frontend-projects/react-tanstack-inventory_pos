import { describe, expect, it } from 'vitest'
import {
  requireAuth,
  requirePermission,
  requireRole,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import { ForbiddenError, UnauthorizedError, ValidationError } from '#/server/auth/errors'
import type { CurrentUserContext } from '#/types/auth'

const activeContext: CurrentUserContext = {
  authUserId: 'auth-user-1',
  profileId: 'profile-1',
  email: 'admin@example.com',
  activeTenantId: 'tenant-1',
  tenantUserId: 'tenant-user-1',
  roles: ['admin'],
  permissions: ['user.view', 'user.invite', 'user.change_role'],
  isOwner: false,
  profileCompleted: true,
  onboardingCompleted: true,
  tenantStatus: 'active',
  completionFlow: null,
}

describe('tenant guard helpers', () => {
  it('rejects missing auth context', () => {
    expect(() => requireAuth(null)).toThrow(UnauthorizedError)
  })

  it('rejects tenant mismatches and inactive tenant memberships', () => {
    expect(() => requireTenantAccess(activeContext, 'tenant-2')).toThrow(ForbiddenError)
    expect(() =>
      requireTenantAccess(
        {
          ...activeContext,
          tenantStatus: 'suspended',
        },
        'tenant-1'
      )
    ).toThrow(ForbiddenError)
  })

  it('enforces role and permission requirements', () => {
    expect(() => requireRole(activeContext, [])).toThrow(ValidationError)
    expect(() => requirePermission(activeContext, [])).toThrow(ValidationError)
    expect(() => requireRole(activeContext, ['res:floor_manager'])).toThrow(
      ForbiddenError
    )
    expect(() => requirePermission(activeContext, 'user.deactivate')).toThrow(
      ForbiddenError
    )
    expect(requireRole(activeContext, ['admin'])).toBe(activeContext)
    expect(requirePermission(activeContext, ['user.view', 'user.deactivate'])).toBe(
      activeContext
    )
  })
})
