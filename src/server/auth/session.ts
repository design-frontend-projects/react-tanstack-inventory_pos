import type { JwtPayload, User, UserMetadata } from '@supabase/supabase-js'
import { getRoleRank } from '#/features/auth/rbac-catalog'
import { mergePermissions } from '#/features/auth/permissions'
import type {
  CompletionFlowContext,
  CurrentUserContext,
  SessionBootstrapPayload,
  SessionUser,
  WorkspaceMembership,
} from '#/types/auth'
import { parseCompletionFlow } from '#/server/auth/completion-flow'
import { createServerSupabaseClient } from '#/server/auth/supabase-server'
import { ServiceUnavailableError, UnauthorizedError } from '#/server/auth/errors'
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
      roleCode: (primaryRole?.code ?? 'res:user'),
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
    roles: roleCodes,
    permissions: permissions,
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

/**
 * The trusted, verified identity of a caller, derived from a validated Supabase
 * access token. Field names mirror the subset of the Supabase `User` shape that
 * the session/account layers actually consume so downstream code is unaffected
 * by the underlying verification mechanism.
 */
export interface AuthenticatedUser {
  id: string
  email: string | null
  phone: string | null
  isAnonymous: boolean
  user_metadata: UserMetadata
}

const JWT_SEGMENT_COUNT = 3

/**
 * Normalizes and structurally validates a bearer access token before any
 * cryptographic work, failing fast (401) on obviously invalid input rather than
 * paying for a JWKS/network round trip on garbage.
 */
function normalizeAccessToken(accessToken: string | null | undefined): string {
  const token = accessToken?.trim() ?? ''

  if (token.length === 0) {
    throw new UnauthorizedError('A Supabase access token is required.')
  }

  // A JWS compact serialization is exactly three base64url segments
  // (header.payload.signature). Anything else can never be a valid token.
  if (token.split('.').length !== JWT_SEGMENT_COUNT) {
    throw new UnauthorizedError('The Supabase access token is malformed.')
  }

  return token
}

function mapClaimsToAuthenticatedUser(claims: JwtPayload): AuthenticatedUser {
  return {
    id: claims.sub,
    email: claims.email ?? null,
    phone: claims.phone ?? null,
    isAnonymous: claims.is_anonymous ?? false,
    user_metadata: claims.user_metadata ?? {},
  }
}

/**
 * Validates a Supabase access token and returns the trusted caller identity.
 *
 * Verification is delegated to `supabase.auth.getClaims`, which verifies the
 * JWT signature and `exp` locally against the project's JWKS (asymmetric
 * signing keys) — avoiding a network round trip per request. For legacy
 * symmetric (HS256) tokens the SDK transparently falls back to a server-side
 * `getUser` call, so correctness holds regardless of the project's key type.
 *
 * The token is passed explicitly, so the client needs no `Authorization`
 * header — this removes the previous double token-passing.
 *
 * Failures are classified rather than collapsed: a bad/expired/malformed token
 * surfaces as {@link UnauthorizedError} (401), while an unreachable or failing
 * Auth service surfaces as {@link ServiceUnavailableError} (503) so outages are
 * never mistaken for authentication failures. Underlying errors are preserved
 * as `cause` for observability instead of being swallowed.
 */
export async function getAuthenticatedSupabaseUser(
  accessToken: string
): Promise<AuthenticatedUser> {
  const token = normalizeAccessToken(accessToken)
  const supabase = createServerSupabaseClient()

  let result: Awaited<ReturnType<typeof supabase.auth.getClaims>>

  try {
    result = await supabase.auth.getClaims(token)
  } catch (cause) {
    // Thrown errors here are transport-level (JWKS fetch / Auth API network
    // failure), never a verdict on the token itself.
    throw new ServiceUnavailableError(
      'Unable to reach the authentication service.',
      { cause }
    )
  }

  const { data, error } = result

  if (error) {
    // Only a clear upstream 5xx counts as an outage; every other auth error
    // (invalid signature, expired, undefined status) fails closed as 401.
    if (typeof error.status === 'number' && error.status >= 500) {
      throw new ServiceUnavailableError(
        'Unable to reach the authentication service.',
        { cause: error }
      )
    }

    throw new UnauthorizedError('Unable to validate the Supabase session.', {
      cause: error,
    })
  }

  if (!data || !data.claims.sub) {
    throw new UnauthorizedError('Unable to validate the Supabase session.')
  }

  return mapClaimsToAuthenticatedUser(data.claims)
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
