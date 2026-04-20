export function hasRole(userRoles: Array<string>, role: string) {
  return userRoles.includes(role)
}

export function hasAnyRole(userRoles: Array<string>, roles: Array<string>) {
  return roles.some((role) => userRoles.includes(role))
}

export function hasPermission(
  userPermissions: Array<string>,
  permission: string
) {
  return userPermissions.includes(permission)
}

export function hasAnyPermission(
  userPermissions: Array<string>,
  permissions: Array<string>
) {
  return permissions.some((permission) => userPermissions.includes(permission))
}

export function hasAllPermissions(
  userPermissions: Array<string>,
  permissions: Array<string>
) {
  return permissions.every((permission) =>
    userPermissions.includes(permission)
  )
}

export type PermissionOverrideInput = {
  code: string
  isAllowed: boolean
}

export function mergePermissions(
  rolePermissions: Array<string>,
  overrides: Array<PermissionOverrideInput>
) {
  const mergedPermissions = new Set(rolePermissions)

  for (const override of overrides) {
    if (override.isAllowed) {
      mergedPermissions.add(override.code)
      continue
    }

    mergedPermissions.delete(override.code)
  }

  return Array.from(mergedPermissions).sort()
}
