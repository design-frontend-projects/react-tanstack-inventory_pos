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
