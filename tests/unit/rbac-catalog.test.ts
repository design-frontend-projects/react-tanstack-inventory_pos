import { describe, expect, it } from 'vitest'
import {
  getRoleRank,
  isTenantAssignableRole,
  normalizeRoleCode,
  ROLE_RANKS,
} from '#/features/auth/rbac-catalog'

describe('rbac catalog', () => {
  it('keeps role rank ordering stable for privilege checks', () => {
    expect(ROLE_RANKS.super_admin).toBeGreaterThan(ROLE_RANKS['res:super_admin'])
    expect(ROLE_RANKS['res:super_admin']).toBeGreaterThan(ROLE_RANKS.admin)
    expect(ROLE_RANKS.admin).toBeGreaterThan(ROLE_RANKS['res:admin'])
    expect(ROLE_RANKS['res:admin']).toBeGreaterThan(
      ROLE_RANKS['res:floor_manager']
    )
    expect(ROLE_RANKS['res:floor_manager']).toBeGreaterThan(ROLE_RANKS.cashier)
    expect(ROLE_RANKS.cashier).toBeGreaterThan(ROLE_RANKS['res:cashier'])
    expect(ROLE_RANKS['res:cashier']).toBeGreaterThan(ROLE_RANKS['res:user'])
    expect(getRoleRank('unknown')).toBe(0)
  })

  it('normalizes alias role codes before rank or lookup checks', () => {
    expect(normalizeRoleCode('res:cachier')).toBe('res:cashier')
    expect(getRoleRank('res:cachier')).toBe(ROLE_RANKS['res:cashier'])
  })

  it('allows canonical tenant roles for tenant-side assignment', () => {
    expect(isTenantAssignableRole('res:user')).toBe(true)
    expect(isTenantAssignableRole('res:cachier')).toBe(true)
    expect(isTenantAssignableRole('super_admin')).toBe(true)
  })
})
