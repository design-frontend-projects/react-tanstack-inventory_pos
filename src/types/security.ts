// Read models for the Security Control Center admin screen. These describe the
// DB-driven RBAC registry (modules -> screens -> actions) plus permission and
// audit summaries surfaced to tenant administrators.

export type SecurityPermissionKind =
  | 'screen'
  | 'menu'
  | 'action'
  | 'api'
  | 'data'
  | 'admin'

export type SecurityScreenAction = {
  id: string
  code: string
  name: string
  actionKey: string
  isActive: boolean
}

export type SecurityScreenNode = {
  id: string
  code: string
  name: string
  path: string | null
  icon: string | null
  displayOrder: number
  showInMenu: boolean
  isActive: boolean
  defaultPermissionCode: string | null
  actions: Array<SecurityScreenAction>
}

export type SecurityModuleNode = {
  id: string
  code: string
  name: string
  description: string | null
  icon: string | null
  displayOrder: number
  isActive: boolean
  screens: Array<SecurityScreenNode>
}

export type SecurityPermissionSummary = {
  code: string
  name: string
  kind: SecurityPermissionKind
  moduleKey: string
  actionKey: string
  description: string | null
  isActive: boolean
}

export type SecurityAuditEntry = {
  id: string
  actionKey: string
  entityType: string
  entityId: string | null
  actorEmail: string | null
  createdAt: string
}

export type SecurityOverviewCounts = {
  modules: number
  screens: number
  actions: number
  permissions: number
  roles: number
  users: number
}

export type SecurityOverviewPayload = {
  counts: SecurityOverviewCounts
  modules: Array<SecurityModuleNode>
  permissions: Array<SecurityPermissionSummary>
  recentAudit: Array<SecurityAuditEntry>
}

// ---- Role management ----

export type ManageableRole = {
  id: string
  code: string
  name: string
  description: string | null
  rank: number
  isSystem: boolean
  isActive: boolean
  assignedUserCount: number
  permissionCodes: Array<string>
}

export type RoleManagementPayload = {
  roles: Array<ManageableRole>
  permissions: Array<SecurityPermissionSummary>
  actorRank: number
}

export type CreateRoleInput = {
  tenantId: string
  name: string
  description?: string | null
  rank: number
  permissionCodes: Array<string>
}

export type UpdateRoleInput = {
  tenantId: string
  roleId: string
  name?: string
  description?: string | null
  isActive?: boolean
  rank?: number
  permissionCodes?: Array<string>
}

// ---- Module management ----

export type ManageableScreen = {
  id: string
  code: string
  name: string
  path: string | null
  // effective values (system default merged with the tenant override)
  showInMenu: boolean
  displayOrder: number
  isActive: boolean
}

export type ManageableModule = {
  id: string
  code: string
  name: string
  description: string | null
  icon: string | null
  displayOrder: number
  isSystem: boolean
  screenCount: number
  isEnabled: boolean
  screens: Array<ManageableScreen>
}

export type ModuleManagementPayload = {
  modules: Array<ManageableModule>
}

export type SetModuleStateInput = {
  tenantId: string
  moduleId: string
  isEnabled: boolean
}

export type SetScreenVisibilityInput = {
  tenantId: string
  screenId: string
  showInMenu: boolean
}

export type ReorderScreensInput = {
  tenantId: string
  moduleId: string
  orderedScreenIds: Array<string>
}
