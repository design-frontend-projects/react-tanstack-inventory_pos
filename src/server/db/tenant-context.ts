import type { WorkspaceMembership } from '#/types/auth'

export function resolveActiveTenantId(options: {
  memberships: Array<WorkspaceMembership>
  preferredTenantId?: string | null
  requestedTenantId?: string | null
}) {
  const { memberships, preferredTenantId, requestedTenantId } = options

  if (requestedTenantId) {
    const requestedMembership = memberships.find(
      (membership) => membership.tenantId === requestedTenantId
    )

    if (requestedMembership) {
      return requestedMembership.tenantId
    }
  }

  if (preferredTenantId) {
    const preferredMembership = memberships.find(
      (membership) => membership.tenantId === preferredTenantId
    )

    if (preferredMembership) {
      return preferredMembership.tenantId
    }
  }

  if (memberships.length === 1) {
    return memberships[0].tenantId
  }

  const activeMembership = memberships.find(
    (membership) => membership.status === 'active'
  )

  return activeMembership?.tenantId ?? memberships.at(0)?.tenantId ?? null
}
