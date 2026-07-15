// Role and permission codes flow through as `string`: system codes come from the
// code catalog, but tenants can define custom roles/permissions at runtime, so
// these are validated against the database rather than a compile-time union.
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
export type CompletionFlowCode = 'owner' | 'invite'

export type CompletionFlowContext = {
  flow: CompletionFlowCode
  registrationId: string | null
  invitationId: string | null
}

export type SessionUser = {
  id: string
  authUserId: string
  displayName: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  avatarUrl: string | null
  title: string | null
  profileCompleted: boolean
  onboardingCompleted: boolean
  locale: AppLocaleCode
  themeMode: ThemeModeCode
}

export type WorkspaceMembership = {
  tenantId: string
  tenantName: string
  roleCode: string
  roleLabel: string
  isOwner: boolean
  status: TenantUserStatusCode
  joinedAt: string | null
}

export type CurrentUserContext = {
  authUserId: string
  profileId: string
  email: string
  activeTenantId: string | null
  tenantUserId: string | null
  roles: Array<string>
  permissions: Array<string>
  isOwner: boolean
  profileCompleted: boolean
  onboardingCompleted: boolean
  tenantStatus: TenantUserStatusCode | null
  completionFlow: CompletionFlowContext | null
}

export type SessionBootstrapPayload = {
  authenticated: boolean
  user: SessionUser | null
  memberships: Array<WorkspaceMembership>
  activeTenantId: string | null
  activeMembership: WorkspaceMembership | null
  context: CurrentUserContext | null
  completionFlow: CompletionFlowContext | null
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
  roleCode: string | null
  roleLabel: string | null
  isOwner: boolean
  invitationId: string | null
  invitationStatus: InvitationStatusCode | null
  invitationSentAt: string | null
}

export type TenantUserFilters = {
  search?: string
  roleCode?: string | 'all'
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
  roleCode: string
  origin: string
}

export type CompleteInvitedProfileInput = {
  firstName: string
  lastName: string
  phone?: string | null
  avatarUrl?: string | null
}

export type StartTenantRegistrationInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  activity: string
  origin: string
}

export type CompleteOwnerOnboardingInput = {
  registrationId: string
  tenantName: string
  timezone: string
  firstName: string
  lastName: string
  phone?: string | null
  avatarUrl?: string | null
  password: string
  confirmPassword: string
}

export type AcceptInvitationInput = {
  invitationId: string
  firstName: string
  lastName: string
  phone?: string | null
  avatarUrl?: string | null
  password?: string | null
  confirmPassword?: string | null
}

export type SendForgotPasswordInput = {
  email: string
  origin: string
}

export type ResetPasswordInput = {
  password: string
  confirmPassword: string
}

export type UpdateProfileInput = {
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
  roleCode: string
}

export type PermissionSummary = {
  code: string
  name: string
  moduleKey: string
  actionKey: string
  description: string | null
}

export type RolePermissionSummary = {
  roleId: string
  code: string
  name: string
  description: string | null
  rank: number
  permissions: Array<string>
}

export type TenantUserPermissionOverrideSummary = {
  permissionCode: string
  isAllowed: boolean
}

export type TenantUserAccessSummary = {
  tenantUserId: string
  displayName: string
  email: string
  roleCode: string | null
  roleLabel: string | null
  isOwner: boolean
  permissionOverrides: Array<TenantUserPermissionOverrideSummary>
}

export type RolesPermissionsPayload = {
  roles: Array<RolePermissionSummary>
  permissions: Array<PermissionSummary>
  users: Array<TenantUserAccessSummary>
}

export type SetUserPermissionOverrideInput = {
  tenantId: string
  tenantUserId: string
  permissionCode: string
  isAllowed: boolean | null
}
