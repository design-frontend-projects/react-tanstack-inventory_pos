import type { PermissionCode, RoleCode } from '#/features/auth/rbac-catalog'

export type AppLocaleCode = 'en' | 'ar'
export type ThemeModeCode = 'light' | 'dark' | 'system'
export type TenantUserStatusCode =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'disabled'
  | 'rejected'
export type InvitationStatusCode =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked'
  | 'failed'

export type SessionUser = {
  id: string
  authUserId: string
  displayName: string
  email: string
  title: string | null
  onboardingCompleted: boolean
  locale: AppLocaleCode
  themeMode: ThemeModeCode
}

export type WorkspaceMembership = {
  tenantId: string
  tenantName: string
  roleCode: RoleCode
  roleLabel: string
  status: TenantUserStatusCode
  joinedAt: string | null
}

export type CurrentUserContext = {
  authUserId: string
  profileId: string
  email: string
  activeTenantId: string | null
  tenantUserId: string | null
  roles: Array<RoleCode>
  permissions: Array<PermissionCode>
  onboardingCompleted: boolean
  tenantStatus: TenantUserStatusCode | null
}

export type SessionBootstrapPayload = {
  authenticated: boolean
  user: SessionUser | null
  memberships: Array<WorkspaceMembership>
  activeTenantId: string | null
  activeMembership: WorkspaceMembership | null
  context: CurrentUserContext | null
}

export type TenantUserListItem = {
  tenantUserId: string
  profileId: string | null
  authUserId: string | null
  email: string
  firstName: string | null
  lastName: string | null
  displayName: string
  phone: string | null
  jobTitle: string | null
  status: TenantUserStatusCode
  joinedAt: string | null
  roleCode: RoleCode | null
  roleLabel: string | null
  invitationId: string | null
  invitationStatus: InvitationStatusCode | null
  invitationSentAt: string | null
}

export type TenantUserFilters = {
  search?: string
  roleCode?: RoleCode | 'all'
  status?: TenantUserStatusCode | 'all'
  invitationStatus?: InvitationStatusCode | 'all'
}

export type InviteTenantUserInput = {
  tenantId: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  jobTitle?: string | null
  roleCode: RoleCode
  origin: string
}

export type CompleteInvitedProfileInput = {
  firstName: string
  lastName: string
  phone?: string | null
  avatarUrl?: string | null
}

export type UpdateTenantUserStatusInput = {
  tenantId: string
  tenantUserId: string
  status: Extract<TenantUserStatusCode, 'active' | 'suspended' | 'disabled'>
}

export type ChangeTenantUserPrimaryRoleInput = {
  tenantId: string
  tenantUserId: string
  roleCode: RoleCode
}
