import { describe, expect, it } from 'vitest'
import {
  getRoleRank,
  isTenantAssignableRole,
  ROLE_RANKS,
} from '#/features/auth/rbac-catalog'

describe('rbac catalog', () => {
  it('keeps role rank ordering stable for privilege checks', () => {
    expect(ROLE_RANKS.super_admin).toBeGreaterThan(ROLE_RANKS.support_admin)
    expect(ROLE_RANKS.support_admin).toBeGreaterThan(ROLE_RANKS.tenant_owner)
    expect(ROLE_RANKS.tenant_owner).toBeGreaterThan(ROLE_RANKS.tenant_admin)
    expect(ROLE_RANKS.tenant_admin).toBeGreaterThan(ROLE_RANKS.manager)
    expect(ROLE_RANKS.manager).toBeGreaterThan(ROLE_RANKS.employee)
    expect(ROLE_RANKS.employee).toBeGreaterThan(ROLE_RANKS.viewer)
    expect(getRoleRank('unknown')).toBe(0)
  })

  it('allows only tenant-scoped roles for tenant-side assignment', () => {
    expect(isTenantAssignableRole('tenant_admin')).toBe(true)
    expect(isTenantAssignableRole('viewer')).toBe(true)
    expect(isTenantAssignableRole('support_admin')).toBe(false)
    expect(isTenantAssignableRole('super_admin')).toBe(false)
  })
})
