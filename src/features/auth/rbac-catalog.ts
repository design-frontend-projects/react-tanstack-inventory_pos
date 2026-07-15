export const ROLE_CODE_ALIASES: Readonly<Partial<Record<string, string>>> = {
  'res:cachier': 'res:cashier',
} as const

export function normalizeRoleCode(roleCode: string) {
  const normalizedRoleCode = roleCode.trim().toLowerCase()

  return ROLE_CODE_ALIASES[normalizedRoleCode] ?? normalizedRoleCode
}

export const ROLE_DEFINITIONS = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Tenant owner-grade access across all tenant and restaurant controls.',
    isSystem: true,
    rank: 100,
  },
  {
    code: 'res:super_admin',
    name: 'Restaurant Super Admin',
    description: 'Restaurant operational super admin with staff and settings control.',
    isSystem: true,
    rank: 90,
  },
  {
    code: 'admin',
    name: 'Admin',
    description: 'Tenant administrator with user and dashboard access.',
    isSystem: true,
    rank: 80,
  },
  {
    code: 'res:admin',
    name: 'Restaurant Admin',
    description: 'Restaurant administrator with order oversight and limited staff visibility.',
    isSystem: true,
    rank: 70,
  },
  {
    code: 'res:floor_manager',
    name: 'Floor Manager',
    description: 'Front-of-house manager focused on live order coordination.',
    isSystem: true,
    rank: 60,
  },
  {
    code: 'cashier',
    name: 'Cashier',
    description: 'Generic cashier access for dashboard and self-service profile actions.',
    isSystem: true,
    rank: 50,
  },
  {
    code: 'res:cashier',
    name: 'Restaurant Cashier',
    description: 'Restaurant cashier with order entry and cashier interface access.',
    isSystem: true,
    rank: 45,
  },
  {
    code: 'res:kitchen',
    name: 'Kitchen',
    description: 'Kitchen role for fulfillment and order status progression.',
    isSystem: true,
    rank: 40,
  },
  {
    code: 'res:user',
    name: 'Restaurant User',
    description: 'Basic restaurant access with self-profile permissions.',
    isSystem: true,
    rank: 30,
  },
] as const

export const PERMISSION_DEFINITIONS = [
  {
    code: 'tenant.view',
    name: 'View Tenant',
    moduleKey: 'tenant',
    actionKey: 'view',
    description: 'View tenant data and scoped settings.',
  },
  {
    code: 'tenant.update',
    name: 'Update Tenant',
    moduleKey: 'tenant',
    actionKey: 'update',
    description: 'Update tenant details and configuration.',
  },
  {
    code: 'tenant.manage_settings',
    name: 'Manage Tenant Settings',
    moduleKey: 'tenant',
    actionKey: 'manage_settings',
    description: 'Manage tenant settings and integrations.',
  },
  {
    code: 'user.view',
    name: 'View Users',
    moduleKey: 'user',
    actionKey: 'view',
    description: 'View tenant users and invitations.',
  },
  {
    code: 'user.invite',
    name: 'Invite Users',
    moduleKey: 'user',
    actionKey: 'invite',
    description: 'Invite, resend, revoke, and manage invitation flow.',
  },
  {
    code: 'user.update',
    name: 'Update Users',
    moduleKey: 'user',
    actionKey: 'update',
    description: 'Update tenant user state and editable account fields.',
  },
  {
    code: 'user.deactivate',
    name: 'Deactivate Users',
    moduleKey: 'user',
    actionKey: 'deactivate',
    description: 'Suspend or disable tenant user access.',
  },
  {
    code: 'user.change_role',
    name: 'Change User Role',
    moduleKey: 'user',
    actionKey: 'change_role',
    description: 'Assign or change tenant user primary roles.',
  },
  {
    code: 'user.assign_permission',
    name: 'Assign User Permission',
    moduleKey: 'user',
    actionKey: 'assign_permission',
    description: 'Assign direct user permission overrides.',
  },
  {
    code: 'profile.view_self',
    name: 'View Own Profile',
    moduleKey: 'profile',
    actionKey: 'view_self',
    description: 'View the authenticated user profile.',
  },
  {
    code: 'profile.update_self',
    name: 'Update Own Profile',
    moduleKey: 'profile',
    actionKey: 'update_self',
    description: 'Update the authenticated user profile.',
  },
  {
    code: 'dashboard.view',
    name: 'View Dashboard',
    moduleKey: 'dashboard',
    actionKey: 'view',
    description: 'Access the tenant dashboard.',
  },
  {
    code: 'role.view',
    name: 'View Roles',
    moduleKey: 'role',
    actionKey: 'view',
    description: 'View tenant roles and their permission mappings.',
  },
  {
    code: 'role.manage',
    name: 'Manage Roles',
    moduleKey: 'role',
    actionKey: 'manage',
    description: 'Create, edit, and delete tenant roles and their permissions.',
  },
  {
    code: 'module.manage',
    name: 'Manage Modules',
    moduleKey: 'module',
    actionKey: 'manage',
    description: 'Enable, disable, and reorder tenant modules and menus.',
  },
  {
    code: 'res.dashboard.view',
    name: 'View Restaurant Dashboard',
    moduleKey: 'restaurant_dashboard',
    actionKey: 'view',
    description: 'Access restaurant operational dashboards.',
  },
  {
    code: 'res.orders.view',
    name: 'View Restaurant Orders',
    moduleKey: 'restaurant_orders',
    actionKey: 'view',
    description: 'View restaurant orders and queue state.',
  },
  {
    code: 'res.orders.create',
    name: 'Create Restaurant Orders',
    moduleKey: 'restaurant_orders',
    actionKey: 'create',
    description: 'Create restaurant orders and cashier drafts.',
  },
  {
    code: 'res.orders.update',
    name: 'Update Restaurant Orders',
    moduleKey: 'restaurant_orders',
    actionKey: 'update',
    description: 'Update restaurant orders and service state.',
  },
  {
    code: 'res.orders.cancel',
    name: 'Cancel Restaurant Orders',
    moduleKey: 'restaurant_orders',
    actionKey: 'cancel',
    description: 'Cancel or reverse restaurant orders.',
  },
  {
    code: 'res.cashier.access',
    name: 'Access Restaurant Cashier',
    moduleKey: 'restaurant_cashier',
    actionKey: 'access',
    description: 'Access cashier controls for restaurant operations.',
  },
  {
    code: 'res.kitchen.access',
    name: 'Access Kitchen Board',
    moduleKey: 'restaurant_kitchen',
    actionKey: 'access',
    description: 'Access kitchen preparation and queue views.',
  },
  {
    code: 'res.kitchen.update_order_status',
    name: 'Update Kitchen Order Status',
    moduleKey: 'restaurant_kitchen',
    actionKey: 'update_order_status',
    description: 'Advance kitchen-facing order statuses.',
  },
  {
    code: 'res.floor.manage',
    name: 'Manage Floor',
    moduleKey: 'restaurant_floor',
    actionKey: 'manage',
    description: 'Manage floor operations, seating, and service state.',
  },
  {
    code: 'res.users.view',
    name: 'View Restaurant Users',
    moduleKey: 'restaurant_users',
    actionKey: 'view',
    description: 'View restaurant user access surfaces.',
  },
  {
    code: 'res.users.manage',
    name: 'Manage Restaurant Users',
    moduleKey: 'restaurant_users',
    actionKey: 'manage',
    description: 'Manage restaurant user access within the tenant scope.',
  },
  {
    code: 'res.settings.manage',
    name: 'Manage Restaurant Settings',
    moduleKey: 'restaurant_settings',
    actionKey: 'manage',
    description: 'Manage restaurant-specific settings and configuration.',
  },
] as const

export type RoleCode = (typeof ROLE_DEFINITIONS)[number]['code']
export type PermissionCode = (typeof PERMISSION_DEFINITIONS)[number]['code']
export const PERMISSION_CODES = PERMISSION_DEFINITIONS.map(
  (definition) => definition.code
) as [PermissionCode, ...PermissionCode[]]

const ROLE_DEFINITION_BY_CODE: Record<string, (typeof ROLE_DEFINITIONS)[number]> =
  Object.fromEntries(
    ROLE_DEFINITIONS.map((definition) => [definition.code, definition])
  ) as Record<string, (typeof ROLE_DEFINITIONS)[number]>

export const ROLE_RANKS: Record<string, number> = Object.fromEntries(
  ROLE_DEFINITIONS.map((definition) => [definition.code, definition.rank])
) as Record<string, number>

export const TENANT_ASSIGNABLE_ROLE_CODES: Array<RoleCode> = ROLE_DEFINITIONS.map(
  (definition) => definition.code
)

export const ROLE_PERMISSION_MAP: Record<RoleCode, Array<PermissionCode>> = {
  super_admin: PERMISSION_DEFINITIONS.map((permission) => permission.code),
  admin: [
    'tenant.view',
    'tenant.update',
    'user.view',
    'user.invite',
    'user.update',
    'dashboard.view',
    'profile.view_self',
    'profile.update_self',
    'role.view',
    'role.manage',
    'module.manage',
  ],
  'res:super_admin': [
    'tenant.view',
    'tenant.manage_settings',
    'user.view',
    'user.invite',
    'user.update',
    'user.deactivate',
    'user.change_role',
    'user.assign_permission',
    'profile.view_self',
    'profile.update_self',
    'res.dashboard.view',
    'res.orders.view',
    'res.orders.create',
    'res.orders.update',
    'res.orders.cancel',
    'res.cashier.access',
    'res.kitchen.access',
    'res.kitchen.update_order_status',
    'res.floor.manage',
    'res.users.view',
    'res.users.manage',
    'res.settings.manage',
    'role.view',
    'role.manage',
    'module.manage',
  ],
  'res:admin': [
    'user.view',
    'profile.view_self',
    'profile.update_self',
    'res.dashboard.view',
    'res.orders.view',
    'res.orders.create',
    'res.orders.update',
    'res.users.view',
  ],
  'res:floor_manager': [
    'profile.view_self',
    'profile.update_self',
    'res.dashboard.view',
    'res.orders.view',
    'res.orders.update',
    'res.floor.manage',
  ],
  cashier: ['dashboard.view', 'profile.view_self', 'profile.update_self'],
  'res:cashier': [
    'profile.view_self',
    'profile.update_self',
    'res.dashboard.view',
    'res.cashier.access',
    'res.orders.view',
    'res.orders.create',
  ],
  'res:kitchen': [
    'profile.view_self',
    'profile.update_self',
    'res.dashboard.view',
    'res.kitchen.access',
    'res.kitchen.update_order_status',
    'res.orders.view',
  ],
  'res:user': ['profile.view_self', 'profile.update_self', 'res.dashboard.view'],
}

export function getRoleDefinition(roleCode: string) {
  const normalizedRoleCode = normalizeRoleCode(roleCode)

  return ROLE_DEFINITION_BY_CODE[normalizedRoleCode] ?? null
}

export function isTenantAssignableRole(roleCode: string): roleCode is RoleCode {
  return TENANT_ASSIGNABLE_ROLE_CODES.includes(
    normalizeRoleCode(roleCode) as RoleCode
  )
}

export function isPermissionCode(permissionCode: string): permissionCode is PermissionCode {
  return PERMISSION_CODES.includes(permissionCode as PermissionCode)
}

export function getRoleRank(roleCode: string) {
  const normalizedRoleCode = normalizeRoleCode(roleCode)

  return ROLE_RANKS[normalizedRoleCode] ?? 0
}
