import { describe, expect, it } from 'vitest'
import {
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
  mergePermissions,
} from '#/features/auth/permissions'

describe('permission helpers', () => {
  it('matches exact roles and permissions', () => {
    expect(hasRole(['admin', 'res:admin'], 'admin')).toBe(true)
    expect(hasPermission(['user.view', 'user.change_role'], 'user.change_role')).toBe(
      true
    )
  })

  it('supports any-role and any-permission checks', () => {
    expect(hasAnyRole(['res:user'], ['cashier', 'res:user'])).toBe(true)
    expect(
      hasAnyPermission(['res.orders.view'], ['res.orders.create', 'res.orders.view'])
    ).toBe(true)
  })

  it('supports all-permission checks', () => {
    expect(
      hasAllPermissions(['user.view', 'user.invite'], ['user.view', 'user.invite'])
    ).toBe(true)
    expect(hasAllPermissions(['user.view'], ['user.view', 'user.invite'])).toBe(false)
  })

  it('merges direct allow and deny overrides on top of role permissions', () => {
    expect(
      mergePermissions(['user.view', 'user.invite'], [
        { code: 'user.invite', isAllowed: false },
        { code: 'user.assign_permission', isAllowed: true },
      ])
    ).toEqual(['user.assign_permission', 'user.view'])
  })
})
