import { prisma } from '#/server/db/client'
import type {
  CurrentUserContext,
  RolesPermissionsPayload,
  SendForgotPasswordInput,
  SetUserPermissionOverrideInput,
  StartTenantRegistrationInput,
  UpdateProfileInput,
} from '#/types/auth'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { createServerSupabaseClient } from '#/server/auth/supabase-server'
import { stripCompletionFlowMetadata } from '#/server/auth/completion-flow'
import {
  buildDisplayName,
  normalizeEmail,
} from '#/server/auth/normalization'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import {
  findPermissionByCode,
  listPermissions,
  setTenantUserPermissionOverride as persistTenantUserPermissionOverride,
} from '#/server/repos/permission-repo'
import {
  ensureProfile,
  findProfileByAuthUserId,
  updateProfile,
  updateProfileCompletion,
} from '#/server/repos/profile-repo'
import {
  createRegistrationRequest,
  findPendingRegistrationRequestByEmail,
  findRegistrationRequestById,
  updateRegistrationRequest,
} from '#/server/repos/registration-request-repo'
import {
  findRoleByCode,
  listTenantAssignableRolesWithPermissions,
} from '#/server/repos/role-repo'
import { setDefaultTenant } from '#/server/repos/preference-repo'
import {
  findTenantUserById,
  listTenantUsersForProfile,
  listTenantUsersWithAccess,
  upsertTenantUser,
} from '#/server/repos/membership-repo'
import { createTenantAccount, findTenantById, updateTenantAccount } from '#/server/repos/tenant-repo'
import {
  findAuthUserById,
  findAuthUserByEmail,
  setAuthUserPassword,
  updateAuthUserMetadata,
} from '#/server/auth/supabase-admin-users'
import { getAuthenticatedSupabaseUser } from '#/server/auth/session'
import { getRoleRank } from '#/features/auth/rbac-catalog'

const OWNER_DEFAULT_ROLE_CODE = 'super_admin'
const REGISTRATION_EXPIRY_IN_DAYS = 2

function buildOwnerCompletionUrl(origin: string, registrationId: string) {
  const redirectUrl = new URL('/complete-account', origin)
  redirectUrl.searchParams.set('flow', 'owner')
  redirectUrl.searchParams.set('registrationId', registrationId)
  return redirectUrl.toString()
}

function getRegistrationExpiryDate() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REGISTRATION_EXPIRY_IN_DAYS)
  return expiresAt
}

function getRegistrationMetadata(input: {
  registrationId: string
  activity: string
  firstName: string
  lastName: string
  phone: string
}) {
  return {
    auth_flow: 'owner',
    registration_id: input.registrationId,
    activity: input.activity,
    is_owner: true,
    default_role: OWNER_DEFAULT_ROLE_CODE,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
  }
}

function getActorRank(context: CurrentUserContext) {
  return Math.max(...context.roles.map((roleCode) => getRoleRank(roleCode)), 0)
}

function isExpired(expiresAt: Date | null | undefined) {
  return !!expiresAt && expiresAt.getTime() < Date.now()
}

export async function startTenantRegistration(input: StartTenantRegistrationInput) {
  const normalizedEmail = normalizeEmail(input.email)
  const existingAuthUser = await findAuthUserByEmail(normalizedEmail)
  const existingProfile = existingAuthUser
    ? await findProfileByAuthUserId(existingAuthUser.id)
    : null

  if (existingProfile) {
    const memberships = await listTenantUsersForProfile(existingProfile.id)
    if (existingProfile.onboardingCompleted || memberships.length > 0) {
      throw new ConflictError('An account already exists for this email address.')
    }
  }

  const pendingRequest = await findPendingRegistrationRequestByEmail(normalizedEmail)
  const expiresAt = getRegistrationExpiryDate()
  const authUserId = existingAuthUser?.id ?? null
  const linkedProfileId = existingProfile?.id ?? null

  const registration = pendingRequest
    ? await updateRegistrationRequest(pendingRequest.id, {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        activity: input.activity,
        authUserId,
        linkedProfileId,
        defaultRoleCode: OWNER_DEFAULT_ROLE_CODE,
        isOwner: true,
        expiresAt,
        status: 'PENDING',
      })
    : await createRegistrationRequest({
        email: normalizedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        activity: input.activity,
        isOwner: true,
        defaultRoleCode: OWNER_DEFAULT_ROLE_CODE,
        authUserId,
        linkedProfileId,
        expiresAt,
      })

  const redirectTo = buildOwnerCompletionUrl(input.origin, registration.id)
  const registrationMetadata = getRegistrationMetadata({
    registrationId: registration.id,
    activity: input.activity,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  })

  if (existingAuthUser) {
    await updateAuthUserMetadata(existingAuthUser.id, {
      ...(existingAuthUser.user_metadata as Record<string, unknown> | undefined),
      ...registrationMetadata,
    })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
      data: registrationMetadata,
      shouldCreateUser: true,
    },
  })

  if (error) {
    throw new ValidationError(error.message)
  }

  await updateRegistrationRequest(registration.id, {
    authUserId,
    sentAt: new Date(),
    metadata: registrationMetadata,
  })

  return {
    registrationId: registration.id,
  }
}

export async function completeOwnerOnboarding(
  actor: CurrentUserContext,
  input: {
    registrationId: string
    tenantName: string
    timezone: string
    firstName: string
    lastName: string
    phone?: string | null
    avatarUrl?: string | null
    password: string
  }
) {
  const registration = await findRegistrationRequestById(input.registrationId)

  if (!registration) {
    throw new NotFoundError('Registration request not found.')
  }

  if (registration.status === 'COMPLETED') {
    const existingTenantId =
      typeof registration.metadata === 'object' &&
      registration.metadata &&
      'tenantId' in registration.metadata
        ? String((registration.metadata as Record<string, unknown>).tenantId ?? '')
        : ''

    if (existingTenantId) {
      return {
        registrationId: registration.id,
        tenantId: existingTenantId,
      }
    }

    throw new ValidationError('This registration has already been completed.')
  }

  if (registration.status !== 'PENDING') {
    throw new ValidationError('This registration request is no longer active.')
  }

  if (isExpired(registration.expiresAt)) {
    await updateRegistrationRequest(registration.id, {
      status: 'EXPIRED',
    })
    throw new ValidationError('This registration request has expired.')
  }

  if (registration.authUserId && registration.authUserId !== actor.authUserId) {
    throw new ForbiddenError('This registration belongs to another account.')
  }

  if (normalizeEmail(registration.email) !== normalizeEmail(actor.email)) {
    throw new ForbiddenError('This registration belongs to a different email address.')
  }

  await setAuthUserPassword(actor.authUserId, input.password)

  const profile = await ensureProfile({
    authUserId: actor.authUserId,
    email: actor.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
  })

  const metadata =
    typeof registration.metadata === 'object' && registration.metadata
      ? (registration.metadata as Record<string, unknown>)
      : {}
  const existingTenantId =
    typeof metadata.tenantId === 'string' ? metadata.tenantId : null
  const existingTenant =
    existingTenantId ? await findTenantById(existingTenantId) : null
  const tenant =
    existingTenant ??
    (await createTenantAccount({
      tenantName: input.tenantName,
      activity: registration.activity,
      timezone: input.timezone,
      ownerProfileId: profile.id,
    }))

  if (existingTenant) {
    await updateTenantAccount(existingTenant.id, {
      name: input.tenantName,
      activity: registration.activity,
      timezone: input.timezone,
      ownerProfileId: profile.id,
    })
  }

  const tenantUser = await upsertTenantUser({
    tenantId: tenant.id,
    profileId: profile.id,
    isOwner: true,
    status: 'ACTIVE',
    joinedAt: new Date(),
  })

  if (!tenantUser) {
    throw new ValidationError('Tenant membership provisioning failed.')
  }

  const superAdminRole = await findRoleByCode(OWNER_DEFAULT_ROLE_CODE)
  if (!superAdminRole) {
    throw new ValidationError('Super admin role seed is missing.')
  }

  await prisma.tenantUserRole.updateMany({
    where: {
      tenantUserId: tenantUser.id,
      isPrimary: true,
    },
    data: {
      isPrimary: false,
    },
  })

  await prisma.tenantUserRole.upsert({
    where: {
      tenantUserId_roleId: {
        tenantUserId: tenantUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {
      isPrimary: true,
      assignedByProfileId: profile.id,
      assignedAt: new Date(),
    },
    create: {
      tenantUserId: tenantUser.id,
      roleId: superAdminRole.id,
      assignedByProfileId: profile.id,
      isPrimary: true,
    },
  })

  await updateProfileCompletion(profile.id, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
  })
  await setDefaultTenant(profile.id, tenant.id)

  const completedAt = new Date()
  await updateRegistrationRequest(registration.id, {
    authUserId: actor.authUserId,
    linkedProfileId: profile.id,
    status: 'COMPLETED',
    completedAt,
    metadata: {
      ...metadata,
      tenantId: tenant.id,
      tenantName: input.tenantName,
      timezone: input.timezone,
    },
  })

  const authUser = await findAuthUserById(actor.authUserId)
  await updateAuthUserMetadata(
    actor.authUserId,
    stripCompletionFlowMetadata(
      authUser.user_metadata as Record<string, unknown> | undefined
    )
  )

  await createAuditLog({
    tenantId: tenant.id,
    actorProfileId: profile.id,
    actionKey: 'registration.completed',
    entityType: 'tenant_registration_request',
    entityId: registration.id,
    newValues: {
      tenantId: tenant.id,
      tenantUserId: tenantUser.id,
      completedAt: completedAt.toISOString(),
    },
  })

  return {
    registrationId: registration.id,
    tenantId: tenant.id,
  }
}

export async function sendForgotPassword(input: SendForgotPasswordInput) {
  const supabase = createServerSupabaseClient()
  const redirectUrl = new URL('/reset-password', input.origin).toString()
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(input.email),
    {
      redirectTo: redirectUrl,
    }
  )

  if (error) {
    throw new ValidationError(error.message)
  }

  return {
    email: normalizeEmail(input.email),
  }
}

export async function resetPassword(accessToken: string, input: { password: string }) {
  const authUser = await getAuthenticatedSupabaseUser(accessToken)
  await setAuthUserPassword(authUser.id, input.password)

  const profile = await findProfileByAuthUserId(authUser.id)
  await createAuditLog({
    actorProfileId: profile?.id ?? null,
    actionKey: 'profile.password_reset',
    entityType: 'profile',
    entityId: profile?.id ?? null,
  })

  return {
    authUserId: authUser.id,
  }
}

export async function updateCurrentUserProfile(
  actor: CurrentUserContext,
  input: UpdateProfileInput
) {
  const profile = await updateProfile(actor.profileId, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
  })

  await createAuditLog({
    tenantId: actor.activeTenantId,
    actorProfileId: actor.profileId,
    actionKey: 'profile.updated',
    entityType: 'profile',
    entityId: profile.id,
    newValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
    },
  })

  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
  }
}

export async function listRolesPermissions(
  actor: CurrentUserContext,
  tenantId: string
): Promise<RolesPermissionsPayload> {
  if (actor.activeTenantId !== tenantId) {
    throw new ForbiddenError('Tenant mismatch for access management.')
  }

  const [roles, permissions, tenantUsers] = await Promise.all([
    listTenantAssignableRolesWithPermissions(),
    listPermissions(),
    listTenantUsersWithAccess(tenantId),
  ])

  return {
    roles: roles.map((role) => ({
      roleId: role.id,
      code: role.code as RolesPermissionsPayload['roles'][number]['code'],
      name: role.name,
      description: role.description ?? null,
      rank: role.rank,
      permissions: role.permissions.map(
        (rolePermission) =>
          rolePermission.permission.code as RolesPermissionsPayload['roles'][number]['permissions'][number]
      ),
    })),
    permissions: permissions.map((permission) => ({
      code: permission.code as RolesPermissionsPayload['permissions'][number]['code'],
      name: permission.name,
      moduleKey: permission.moduleKey,
      actionKey: permission.actionKey,
      description: permission.description ?? null,
    })),
    users: tenantUsers.map((tenantUser) => ({
      tenantUserId: tenantUser.id,
      displayName: buildDisplayName(
        tenantUser.profile.firstName,
        tenantUser.profile.lastName,
        tenantUser.profile.email
      ),
      email: tenantUser.profile.email,
      roleCode:
        (tenantUser.roles.at(0)?.role.code as RolesPermissionsPayload['users'][number]['roleCode']) ??
        null,
      roleLabel: tenantUser.roles.at(0)?.role.name ?? null,
      isOwner: tenantUser.isOwner,
      permissionOverrides: tenantUser.permissionOverrides.map((override) => ({
        permissionCode:
          override.permission.code as RolesPermissionsPayload['users'][number]['permissionOverrides'][number]['permissionCode'],
        isAllowed: override.isAllowed,
      })),
    })),
  }
}

export async function setUserPermissionOverride(
  actor: CurrentUserContext,
  input: SetUserPermissionOverrideInput
) {
  if (actor.activeTenantId !== input.tenantId) {
    throw new ForbiddenError('Tenant mismatch for permission update.')
  }

  if (actor.tenantUserId === input.tenantUserId) {
    throw new ForbiddenError('You cannot change your own direct permissions.')
  }

  const [tenantUser, permission] = await Promise.all([
    findTenantUserById(input.tenantId, input.tenantUserId),
    findPermissionByCode(input.permissionCode),
  ])

  if (!tenantUser) {
    throw new NotFoundError('Tenant user not found.')
  }

  if (!permission) {
    throw new NotFoundError('Permission not found.')
  }

  const targetPrimaryRole = tenantUser.roles.find((role) => role.isPrimary)?.role
  if (targetPrimaryRole && getActorRank(actor) <= targetPrimaryRole.rank) {
    throw new ForbiddenError('You cannot change permissions for equal or higher privilege.')
  }

  await persistTenantUserPermissionOverride({
    tenantUserId: tenantUser.id,
    permissionId: permission.id,
    isAllowed: input.isAllowed,
    assignedByProfileId: actor.profileId,
  })

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actionKey: 'user.permission_override',
    entityType: 'tenant_user_permission',
    entityId: tenantUser.id,
    newValues: {
      permissionCode: input.permissionCode,
      isAllowed: input.isAllowed,
    },
  })

  return {
    tenantUserId: tenantUser.id,
    permissionCode: input.permissionCode,
    isAllowed: input.isAllowed,
  }
}
