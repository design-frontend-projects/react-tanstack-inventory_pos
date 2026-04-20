import { describe, expect, it } from 'vitest'
import { resolveActiveTenantId } from '#/server/db/tenant-context'
import type { WorkspaceMembership } from '#/types/auth'

const memberships: Array<WorkspaceMembership> = [
  {
    tenantId: 'tenant-a',
    tenantName: 'Tenant A',
    roleCode: 'tenant_admin',
    roleLabel: 'Tenant Admin',
    status: 'active',
    joinedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    tenantId: 'tenant-b',
    tenantName: 'Tenant B',
    roleCode: 'viewer',
    roleLabel: 'Viewer',
    status: 'invited',
    joinedAt: null,
  },
]

describe('resolveActiveTenantId', () => {
  it('prefers an explicitly requested tenant when accessible', () => {
    expect(
      resolveActiveTenantId({
        memberships,
        requestedTenantId: 'tenant-b',
      })
    ).toBe('tenant-b')
  })

  it('falls back to the persisted tenant when no request is present', () => {
    expect(
      resolveActiveTenantId({
        memberships,
        preferredTenantId: 'tenant-a',
      })
    ).toBe('tenant-a')
  })

  it('falls back to the first active tenant before any non-active membership', () => {
    expect(resolveActiveTenantId({ memberships })).toBe('tenant-a')
  })
})
