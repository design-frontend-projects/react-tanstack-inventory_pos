import { describe, expect, it } from 'vitest'
import {
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
} from '#/features/auth/permissions'

describe('permission helpers', () => {
  it('matches exact roles and permissions', () => {
    expect(hasRole(['tenant_admin', 'manager'], 'tenant_admin')).toBe(true)
    expect(hasPermission(['user.view', 'role.assign'], 'role.assign')).toBe(true)
  })

  it('supports any-role and any-permission checks', () => {
    expect(hasAnyRole(['employee'], ['viewer', 'employee'])).toBe(true)
    expect(hasAnyPermission(['inventory.view'], ['inventory.edit', 'inventory.view'])).toBe(true)
  })

  it('supports all-permission checks', () => {
    expect(
      hasAllPermissions(['user.view', 'user.invite'], ['user.view', 'user.invite'])
    ).toBe(true)
    expect(hasAllPermissions(['user.view'], ['user.view', 'user.invite'])).toBe(false)
  })
})
