import type { User } from '@supabase/supabase-js'
import { getRoleRank } from '#/features/auth/rbac-catalog'
import { mergePermissions } from '#/features/auth/permissions'
import type {
  CompletionFlowContext,
  CurrentUserContext,
  SessionBootstrapPayload,
  SessionUser,
  WorkspaceMembership,
} from '#/types/auth'
import { createServerSupabaseClient } from '#/server/auth/supabase-server'
import { UnauthorizedError } from '#/server/auth/errors'
import { buildDisplayName, normalizeEmail } from '#/server/auth/normalization'
import { resolveActiveTenantId } from '#/server/db/tenant-context'
import { listTenantUsersForProfile, findTenantUserByTenantAndProfile } from '#/server/repos/membership-repo'
import { ensurePreferenceProfile } from '#/server/repos/preference-repo'
import { ensureProfile } from '#/server/repos/profile-repo'

function parseMetadataString(
  metadata: User['user_metadata'],
  ...keys: Array<string>
) {
  for (const key of keys) {
    const value = metadata[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

function parseCompletionFlow(metadata: User['user_metadata']): CompletionFlowContext | null {
  const flow = parseMetadataString(metadata, 'auth_flow', 'flow')
  const registrationId = parseMetadataString(
    metadata,
    'registration_id',
    'registrationId'
  )
  const invitationId = parseMetadataString(
    metadata,
    'invitation_id',
    'invitationId'
  )

  if (flow !== 'owner' && flow !== 'invite') {
    return null
  }

  return {
    flow,
    registrationId,
    invitationId,
  }
}

function mapMemberships(
  tenantUsers: Awaited<ReturnType<typeof listTenantUsersForProfile>>
): Array<WorkspaceMembership> {
  return tenantUsers.map((tenantUser) => {
    const primaryRole =
      tenantUser.roles.at(0)?.role ??
      tenantUser.roles
        .map((tenantUserRole) => tenantUserRole.role)
        .sort((left, right) => right.rank - left.rank)
        .at(0) ??
      null
    return {
      tenantId: tenantUser.tenantId,
      tenantName: tenantUser.tenant.name,
      roleCode: (primaryRole?.code ?? 'res:user') as WorkspaceMembership['roleCode'],
      roleLabel: primaryRole?.name ?? 'Restaurant User',
      isOwner: tenantUser.isOwner,
      status: tenantUser.status.toLowerCase() as WorkspaceMembership['status'],
      joinedAt: tenantUser.joinedAt?.toISOString() ?? null,
    }
  })
}

function mapSessionUser(profile: {
  id: string
  authUserId: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  avatarUrl: string | null
  profileCompleted: boolean
  onboardingCompleted: boolean
  preferenceProfile: {
    locale: 'EN' | 'AR'
    themeMode: 'LIGHT' | 'DARK' | 'SYSTEM'
  } | null
}): SessionUser {
  return {
    id: profile.id,
    authUserId: profile.authUserId,
    displayName: buildDisplayName(profile.firstName, profile.lastName, profile.email),
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    title: null,
    profileCompleted: profile.profileCompleted,
    onboardingCompleted: profile.onboardingCompleted,
    locale: profile.preferenceProfile?.locale.toLowerCase() as SessionUser['locale'],
    themeMode: profile.preferenceProfile?.themeMode.toLowerCase() as SessionUser['themeMode'],
  }
}

function mapCurrentUserContext(
  profile: {
    id: string
    authUserId: string
    email: string
    profileCompleted: boolean
    onboardingCompleted: boolean
  },
  tenantUser:
    | (Awaited<ReturnType<typeof findTenantUserByTenantAndProfile>> & {})
    | null,
  activeTenantId: string | null,
  completionFlow: CompletionFlowContext | null
): CurrentUserContext {
  const roleCodes = tenantUser
    ? Array.from(
        new Set(
          tenantUser.roles
            .map((tenantUserRole) => tenantUserRole.role.code)
            .sort((left, right) => getRoleRank(right) - getRoleRank(left))
        )
      )
    : []

  const permissions = tenantUser
    ? mergePermissions(
        tenantUser.roles.flatMap((tenantUserRole) =>
          tenantUserRole.role.permissions.map(
            (rolePermission) => rolePermission.permission.code
          )
        ),
        tenantUser.permissionOverrides.map((override) => ({
          code: override.permission.code,
          isAllowed: override.isAllowed,
        }))
      )
    : []

  return {
    authUserId: profile.authUserId,
    profileId: profile.id,
    email: profile.email,
    activeTenantId,
    tenantUserId: tenantUser?.id ?? null,
    roles: roleCodes as CurrentUserContext['roles'],
    permissions: permissions as CurrentUserContext['permissions'],
    isOwner: tenantUser?.isOwner ?? false,
    profileCompleted: profile.profileCompleted,
    onboardingCompleted: profile.onboardingCompleted,
    tenantStatus: tenantUser?.status.toLowerCase() as CurrentUserContext['tenantStatus'],
    completionFlow,
  }
}

export function getAccessTokenFromHeaders(headers: HeadersInit | undefined) {
  if (!headers) {
    return null
  }

  const normalizedHeaders = new Headers(headers)
  const authorization = normalizedHeaders.get('authorization')

  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

export async function getAuthenticatedSupabaseUser(accessToken: string) {
  const supabase = createServerSupabaseClient(accessToken)
  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error) {
    throw new UnauthorizedError('Unable to validate the Supabase session.')
  }

  return data.user
}

export async function bootstrapSession(options: {
  accessToken: string
  requestedTenantId?: string | null
}): Promise<SessionBootstrapPayload> {
  const authUser = await getAuthenticatedSupabaseUser(options.accessToken)

  const profile = await ensureProfile({
    authUserId: authUser.id,
    email: authUser.email ?? '',
    firstName: parseMetadataString(authUser.user_metadata, 'first_name', 'firstName'),
    lastName: parseMetadataString(authUser.user_metadata, 'last_name', 'lastName'),
    phone: parseMetadataString(authUser.user_metadata, 'phone'),
    avatarUrl: parseMetadataString(authUser.user_metadata, 'avatar_url', 'avatarUrl'),
  })

  const preferenceProfile = await ensurePreferenceProfile(profile.id)
  const tenantUsers = await listTenantUsersForProfile(profile.id)
  const memberships = mapMemberships(tenantUsers)
  const activeTenantId = resolveActiveTenantId({
    memberships,
    preferredTenantId: preferenceProfile.defaultTenantId,
    requestedTenantId: options.requestedTenantId,
  })
  const activeMembership =
    memberships.find((membership) => membership.tenantId === activeTenantId) ?? null
  const tenantUser = activeTenantId
    ? await findTenantUserByTenantAndProfile(activeTenantId, profile.id)
    : null
  const completionFlow = parseCompletionFlow(authUser.user_metadata)

  return {
    authenticated: true,
    user: mapSessionUser({
      ...profile,
      preferenceProfile,
    }),
    memberships,
    activeTenantId,
    activeMembership,
    context: mapCurrentUserContext(
      profile,
      tenantUser,
      activeTenantId,
      completionFlow
    ),
    completionFlow,
  }
}

export async function getCurrentUserContext(options: {
  accessToken: string
  tenantId?: string | null
}) {
  const bootstrap = await bootstrapSession({
    accessToken: options.accessToken,
    requestedTenantId: options.tenantId,
  })

  return bootstrap.context
}

export function anonymousSessionBootstrap(): SessionBootstrapPayload {
  return {
    authenticated: false,
    user: null,
    memberships: [],
    activeTenantId: null,
    activeMembership: null,
    context: null,
    completionFlow: null,
  }
}

export function getAuthUserEmail(authUser: User) {
  return normalizeEmail(authUser.email ?? '')
}
