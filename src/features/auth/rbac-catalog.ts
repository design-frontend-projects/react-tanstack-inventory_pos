export const ROLE_DEFINITIONS = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Global operational control across every tenant.',
    isSystem: true,
    rank: 100,
  },
  {
    code: 'support_admin',
    name: 'Support Admin',
    description: 'Back-office support role with elevated troubleshooting access.',
    isSystem: true,
    rank: 90,
  },
  {
    code: 'tenant_owner',
    name: 'Tenant Owner',
    description: 'Primary business owner with full tenant management access.',
    isSystem: false,
    rank: 80,
  },
  {
    code: 'tenant_admin',
    name: 'Tenant Admin',
    description: 'Tenant administrator with user and settings access.',
    isSystem: false,
    rank: 70,
  },
  {
    code: 'manager',
    name: 'Manager',
    description: 'Operational manager with restricted management permissions.',
    isSystem: false,
    rank: 60,
  },
  {
    code: 'employee',
    name: 'Employee',
    description: 'Standard employee role for daily operational tasks.',
    isSystem: false,
    rank: 50,
  },
  {
    code: 'viewer',
    name: 'Viewer',
    description: 'Read-only role for audit and visibility-only access.',
    isSystem: false,
    rank: 40,
  },
] as const

export const PERMISSION_DEFINITIONS = [
  {
    code: 'user.view',
    name: 'View Users',
    moduleKey: 'user',
    actionKey: 'view',
    description: 'View tenant users and invitation state.',
  },
  {
    code: 'user.invite',
    name: 'Invite Users',
    moduleKey: 'user',
    actionKey: 'invite',
    description: 'Invite a user into the tenant.',
  },
  {
    code: 'user.resend_invite',
    name: 'Resend Invitation',
    moduleKey: 'user',
    actionKey: 'resend_invite',
    description: 'Resend or refresh an invitation email.',
  },
  {
    code: 'user.suspend',
    name: 'Suspend Users',
    moduleKey: 'user',
    actionKey: 'suspend',
    description: 'Suspend a tenant user from active access.',
  },
  {
    code: 'user.activate',
    name: 'Activate Users',
    moduleKey: 'user',
    actionKey: 'activate',
    description: 'Restore tenant user access.',
  },
  {
    code: 'role.assign',
    name: 'Assign Roles',
    moduleKey: 'role',
    actionKey: 'assign',
    description: 'Assign and update tenant roles.',
  },
  {
    code: 'settings.view',
    name: 'View Settings',
    moduleKey: 'settings',
    actionKey: 'view',
    description: 'Access tenant settings surfaces.',
  },
  {
    code: 'inventory.view',
    name: 'View Inventory',
    moduleKey: 'inventory',
    actionKey: 'view',
    description: 'Access inventory pages.',
  },
  {
    code: 'inventory.edit',
    name: 'Edit Inventory',
    moduleKey: 'inventory',
    actionKey: 'edit',
    description: 'Update inventory data.',
  },
  {
    code: 'pos.view',
    name: 'View POS',
    moduleKey: 'pos',
    actionKey: 'view',
    description: 'Access POS surfaces.',
  },
  {
    code: 'pos.create',
    name: 'Create POS Orders',
    moduleKey: 'pos',
    actionKey: 'create',
    description: 'Create and submit POS orders.',
  },
  {
    code: 'outlet.view',
    name: 'View Outlets',
    moduleKey: 'outlet',
    actionKey: 'view',
    description: 'Access outlet and branch surfaces.',
  },
] as const

export type RoleCode = (typeof ROLE_DEFINITIONS)[number]['code']
export type PermissionCode = (typeof PERMISSION_DEFINITIONS)[number]['code']

export const ROLE_RANKS: Record<RoleCode, number> = Object.fromEntries(
  ROLE_DEFINITIONS.map((definition) => [definition.code, definition.rank])
) as Record<RoleCode, number>

export const TENANT_ASSIGNABLE_ROLE_CODES = ROLE_DEFINITIONS.filter(
  (definition) => !definition.isSystem
).map((definition) => definition.code) as Array<RoleCode>

export const ROLE_PERMISSION_MAP: Record<RoleCode, Array<PermissionCode>> = {
  super_admin: PERMISSION_DEFINITIONS.map((permission) => permission.code),
  support_admin: [
    'user.view',
    'user.resend_invite',
    'settings.view',
    'inventory.view',
    'pos.view',
    'outlet.view',
  ],
  tenant_owner: PERMISSION_DEFINITIONS.map((permission) => permission.code),
  tenant_admin: [
    'user.view',
    'user.invite',
    'user.resend_invite',
    'user.suspend',
    'user.activate',
    'role.assign',
    'settings.view',
    'inventory.view',
    'inventory.edit',
    'pos.view',
    'pos.create',
    'outlet.view',
  ],
  manager: [
    'user.view',
    'inventory.view',
    'inventory.edit',
    'pos.view',
    'pos.create',
    'outlet.view',
  ],
  employee: ['inventory.view', 'pos.view', 'pos.create', 'outlet.view'],
  viewer: ['inventory.view', 'pos.view', 'outlet.view'],
}

export function isTenantAssignableRole(roleCode: string): roleCode is RoleCode {
  return TENANT_ASSIGNABLE_ROLE_CODES.includes(roleCode as RoleCode)
}

export function getRoleRank(roleCode: string) {
  return roleCode in ROLE_RANKS ? ROLE_RANKS[roleCode as RoleCode] : 0
}
