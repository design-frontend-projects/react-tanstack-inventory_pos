import type {
  CurrentUserContext,
  EffectivePermissionEntry,
  EffectivePermissionSource,
  TenantUserEffectiveAccess,
} from '#/types/auth'
import { ForbiddenError, NotFoundError } from '#/server/auth/errors'
import { buildDisplayName } from '#/server/auth/normalization'
import { findTenantUserWithRolePermissions } from '#/server/repos/membership-repo'

type PermissionMeta = { name: string; moduleKey: string }

// Resolve exactly what a tenant user can do: the union of every assigned role's
// permissions merged with per-user overrides (allow adds, deny removes), tagged
// with provenance so admins can see *why* a permission is (not) effective.
export async function getTenantUserEffectiveAccess(
  actor: CurrentUserContext,
  tenantId: string,
  tenantUserId: string
): Promise<TenantUserEffectiveAccess> {
  if (actor.activeTenantId !== tenantId) {
    throw new ForbiddenError('Tenant mismatch for access review.')
  }

  const tenantUser = await findTenantUserWithRolePermissions(tenantId, tenantUserId)
  if (!tenantUser) {
    throw new NotFoundError('Tenant user not found.')
  }

  const metaByCode = new Map<string, PermissionMeta>()
  const rolePermissionCodes = new Set<string>()

  for (const tenantUserRole of tenantUser.roles) {
    for (const rolePermission of tenantUserRole.role.permissions) {
      const { code, name, moduleKey } = rolePermission.permission
      rolePermissionCodes.add(code)
      metaByCode.set(code, { name, moduleKey })
    }
  }

  const overrideByCode = new Map<string, boolean>()
  for (const override of tenantUser.permissionOverrides) {
    overrideByCode.set(override.permission.code, override.isAllowed)
    metaByCode.set(override.permission.code, {
      name: override.permission.name,
      moduleKey: override.permission.moduleKey,
    })
  }

  const allCodes = new Set<string>([
    ...rolePermissionCodes,
    ...overrideByCode.keys(),
  ])

  const effectivePermissions: Array<EffectivePermissionEntry> = Array.from(allCodes)
    .map((code) => {
      const inRole = rolePermissionCodes.has(code)
      const override = overrideByCode.get(code)
      const meta = metaByCode.get(code)

      let source: EffectivePermissionSource
      let effective: boolean
      if (override === false) {
        source = 'denied'
        effective = false
      } else if (override === true && !inRole) {
        source = 'granted'
        effective = true
      } else {
        source = 'role'
        effective = true
      }

      return {
        code,
        name: meta?.name ?? code,
        moduleKey: meta?.moduleKey ?? '',
        source,
        effective,
      }
    })
    .sort(
      (left, right) =>
        left.moduleKey.localeCompare(right.moduleKey) ||
        left.code.localeCompare(right.code)
    )

  const roleCodes = Array.from(
    new Set(tenantUser.roles.map((tenantUserRole) => tenantUserRole.role.code))
  )
  const roleLabels = Array.from(
    new Set(tenantUser.roles.map((tenantUserRole) => tenantUserRole.role.name))
  )

  return {
    tenantUserId: tenantUser.id,
    displayName: buildDisplayName(
      tenantUser.profile.firstName,
      tenantUser.profile.lastName,
      tenantUser.profile.email
    ),
    email: tenantUser.profile.email,
    roleCodes,
    roleLabels,
    effectivePermissions,
  }
}
