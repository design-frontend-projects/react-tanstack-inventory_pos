import { prisma } from '#/server/db/client'
import {
  getRoleRank,
  isTenantAssignableRole,
} from '#/features/auth/rbac-catalog'
import { canResendInvitation } from '#/features/auth/invitations'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type {
  AcceptInvitationInput,
  ChangeTenantUserPrimaryRoleInput,
  CompleteInvitedProfileInput,
  CurrentUserContext,
  InvitationStatusCode,
  InviteTenantUserInput,
  TenantUserFilters,
  TenantUserListItem,
  UpdateTenantUserStatusInput,
} from '#/types/auth'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { createAdminSupabaseClient } from '#/server/auth/supabase-admin'
import {
  findAuthUserByEmail,
  setAuthUserPassword,
  updateAuthUserMetadata,
} from '#/server/auth/supabase-admin-users'
import {
  buildDisplayName,
  normalizeEmail,
  normalizeOptionalText,
} from '#/server/auth/normalization'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import {
  createInvitation,
  findInvitationById,
  findLatestInvitationForTenantEmail,
  findPendingInvitationForAuthUser,
  updateInvitation,
} from '#/server/repos/invitation-repo'
import {
  findTenantUserById,
  findTenantUserByTenantAndProfile,
  upsertTenantUser,
} from '#/server/repos/membership-repo'
import { setDefaultTenant } from '#/server/repos/preference-repo'
import { findRoleByCode } from '#/server/repos/role-repo'
import {
  ensureProfile,
  findProfileByAuthUserId,
  updateProfileCompletion,
} from '#/server/repos/profile-repo'

const INVITATION_EXPIRY_IN_DAYS = 7

function getActorRank(context: CurrentUserContext) {
  return Math.max(...context.roles.map((roleCode) => getRoleRank(roleCode)), 0)
}

async function syncPendingInvitationState(input: {
  invitationId: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  jobTitle?: string | null
  roleId: string
  roleCode: string
  authUserId?: string | null
  invitedByProfileId: string
  tenantId: string
  expiresAt?: Date | null
}) {
  return updateInvitation(input.invitationId, {
    email: normalizeEmail(input.email),
    firstName: input.firstName,
    lastName: input.lastName,
    phone: normalizeOptionalText(input.phone),
    jobTitle: normalizeOptionalText(input.jobTitle),
    roleId: input.roleId,
    authUserId: input.authUserId ?? null,
    invitedByProfileId: input.invitedByProfileId,
    status: 'PENDING',
    acceptedAt: null,
    revokedAt: null,
    expiresAt: input.expiresAt ?? null,
    metadata: {
      tenantId: input.tenantId,
      roleCode: input.roleCode,
      roleId: input.roleId,
    },
  })
}

function buildInvitationCompletionUrl(origin: string, invitationId: string) {
  const redirectUrl = new URL('/complete-account', origin)
  redirectUrl.searchParams.set('flow', 'invite')
  redirectUrl.searchParams.set('invitationId', invitationId)
  return redirectUrl.toString()
}

function buildInvitationMetadata(input: {
  invitationId: string
  tenantId: string
  roleCode: string
  roleId: string
  firstName: string
  lastName: string
  phone?: string | null
  jobTitle?: string | null
  invitedByProfileId: string
}) {
  return {
    auth_flow: 'invite',
    invitation_id: input.invitationId,
    tenant_id: input.tenantId,
    role_code: input.roleCode,
    role_id: input.roleId,
    invited_by: input.invitedByProfileId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: normalizeOptionalText(input.phone),
    job_title: normalizeOptionalText(input.jobTitle),
  }
}

function getInvitationExpiryDate() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_IN_DAYS)
  return expiresAt
}

function assertInvitationCanBeAccepted(
  invitation: Awaited<ReturnType<typeof findInvitationById>>
): asserts invitation is NonNullable<Awaited<ReturnType<typeof findInvitationById>>> {
  if (!invitation) {
    throw new NotFoundError('Invitation not found.')
  }

  const invitationStatus = invitation.status.toLowerCase() as InvitationStatusCode
  if (invitationStatus === 'revoked') {
    throw new ValidationError('This invitation has been revoked.')
  }

  if (invitationStatus === 'accepted') {
    throw new ValidationError('This invitation has already been accepted.')
  }

  if (
    invitation.expiresAt &&
    invitation.expiresAt.getTime() < Date.now()
  ) {
    throw new ValidationError('This invitation has expired.')
  }

  if (invitationStatus !== 'pending') {
    throw new ValidationError('Only pending invitations can be accepted.')
  }
}

async function ensurePrimaryRoleAssignment(input: {
  tenantUserId: string
  roleId: string
  actorProfileId: string
}) {
  await prisma.tenantUserRole.updateMany({
    where: {
      tenantUserId: input.tenantUserId,
      isPrimary: true,
    },
    data: {
      isPrimary: false,
    },
  })

  const existingRole = await prisma.tenantUserRole.findFirst({
    where: {
      tenantUserId: input.tenantUserId,
      roleId: input.roleId,
    },
  })

  if (existingRole) {
    return prisma.tenantUserRole.update({
      where: {
        id: existingRole.id,
      },
      data: {
        isPrimary: true,
        assignedByProfileId: input.actorProfileId,
        assignedAt: new Date(),
      },
      include: {
        role: true,
      },
    })
  }

  return prisma.tenantUserRole.create({
    data: {
      tenantUserId: input.tenantUserId,
      roleId: input.roleId,
      assignedByProfileId: input.actorProfileId,
      isPrimary: true,
    },
    include: {
      role: true,
    },
  })
}

function mapTenantUserListItem(
  tenantUser: Prisma.TenantUserGetPayload<{
    include: {
      profile: true
      roles: {
        include: {
          role: true
        }
      }
    }
  }>,
  invitation: Prisma.user_invitationsGetPayload<Record<string, never>> | undefined
): TenantUserListItem {
  const primaryRole = tenantUser.roles.at(0)?.role ?? null
  const profile = tenantUser.profile

  return {
    tenantUserId: tenantUser.id,
    profileId: profile.id,
    authUserId: profile.authUserId,
    email: profile.email,
    firstName: profile.firstName ?? invitation?.firstName ?? null,
    lastName: profile.lastName ?? invitation?.lastName ?? null,
    displayName: buildDisplayName(
      profile.firstName ?? invitation?.firstName,
      profile.lastName ?? invitation?.lastName,
      profile.email
    ),
    phone: profile.phone ?? invitation?.phone ?? null,
    jobTitle: tenantUser.jobTitle ?? invitation?.jobTitle ?? null,
    status: tenantUser.status.toLowerCase() as TenantUserListItem['status'],
    joinedAt: tenantUser.joinedAt?.toISOString() ?? null,
    roleCode: (primaryRole?.code ?? null) as TenantUserListItem['roleCode'],
    roleLabel: primaryRole?.name ?? null,
    isOwner: tenantUser.isOwner,
    invitationId: invitation?.id ?? null,
    invitationStatus: invitation
      ? (invitation.status.toLowerCase() as TenantUserListItem['invitationStatus'])
      : null,
    invitationSentAt: invitation?.sentAt?.toISOString() ?? null,
  }
}

export async function listTenantUsersForManagement(
  tenantId: string,
  filters: TenantUserFilters | undefined
) {
  const search = filters?.search?.trim()

  const tenantUsers = await prisma.tenantUser.findMany({
    where: {
      tenantId,
      ...(filters?.status && filters.status !== 'all'
        ? { status: filters.status.toUpperCase() as never }
        : {}),
      ...(filters?.roleCode && filters.roleCode !== 'all'
        ? {
            roles: {
              some: {
                isPrimary: true,
                role: {
                  code: filters.roleCode,
                },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                profile: {
                  email: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                profile: {
                  firstName: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                profile: {
                  lastName: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      profile: true,
      roles: {
        where: {
          isPrimary: true,
        },
        include: {
          role: true,
        },
        orderBy: {
          assignedAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const emails = tenantUsers.map((tenantUser) => tenantUser.profile.email)
  const invitations = await prisma.user_invitations.findMany({
    where: {
      tenantId,
      ...(emails.length
        ? {
            email: {
              in: emails,
            },
          }
        : {}),
      ...(filters?.invitationStatus && filters.invitationStatus !== 'all'
        ? { status: filters.invitationStatus.toUpperCase() as never }
        : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const latestInvitationByEmail = new Map<string, (typeof invitations)[number]>()
  for (const invitation of invitations) {
    const key = normalizeEmail(invitation.email)

    if (!latestInvitationByEmail.has(key)) {
      latestInvitationByEmail.set(key, invitation)
    }
  }

  return tenantUsers
    .map((tenantUser) =>
      mapTenantUserListItem(
        tenantUser,
        latestInvitationByEmail.get(normalizeEmail(tenantUser.profile.email))
      )
    )
    .filter((tenantUser) =>
      filters?.invitationStatus && filters.invitationStatus !== 'all'
        ? tenantUser.invitationStatus === filters.invitationStatus
        : true
    )
}

export async function inviteTenantUser(
  actor: CurrentUserContext,
  input: InviteTenantUserInput
) {
  if (!isTenantAssignableRole(input.roleCode)) {
    throw new ValidationError('The selected role cannot be assigned in this tenant.')
  }

  if (actor.activeTenantId !== input.tenantId) {
    throw new ForbiddenError('Tenant mismatch for invitation request.')
  }

  const role = await findRoleByCode(input.roleCode)
  if (!role || !role.isActive) {
    throw new ValidationError('The selected role does not exist or is inactive.')
  }

  if (getActorRank(actor) <= role.rank) {
    throw new ForbiddenError('You cannot assign a role above your authority.')
  }

  const normalizedEmail = normalizeEmail(input.email)
  const existingAuthUser = await findAuthUserByEmail(normalizedEmail)
  const existingProfile = existingAuthUser
    ? await findProfileByAuthUserId(existingAuthUser.id)
    : null
  const latestInvitation = await findLatestInvitationForTenantEmail(
    input.tenantId,
    normalizedEmail
  )
  const existingTenantUser = existingProfile
    ? await findTenantUserByTenantAndProfile(input.tenantId, existingProfile.id)
    : null

  if (existingTenantUser && existingTenantUser.status !== 'INVITED') {
    throw new ConflictError('User already belongs to this tenant.')
  }

  const latestInvitationStatus = latestInvitation?.status
    .toLowerCase() as InvitationStatusCode | undefined

  if (latestInvitationStatus === 'pending') {
    throw new ConflictError('A pending invitation already exists for this email.')
  }

  let profile = existingProfile

  if (!profile && existingAuthUser) {
    profile = await ensureProfile({
      authUserId: existingAuthUser.id,
      email: normalizedEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    })
  }

  let authUserId = existingAuthUser?.id ?? profile?.authUserId ?? null
  let tenantUser =
    profile &&
    (await upsertTenantUser({
      tenantId: input.tenantId,
      profileId: profile.id,
      invitedByProfileId: actor.profileId,
      jobTitle: input.jobTitle,
      isOwner: false,
      status: 'INVITED',
      joinedAt: null,
    }))

  if (tenantUser) {
    await ensurePrimaryRoleAssignment({
      tenantUserId: tenantUser.id,
      roleId: role.id,
      actorProfileId: actor.profileId,
    })
  }

  const expiresAt = getInvitationExpiryDate()
  const invitation =
    latestInvitation && latestInvitationStatus === 'expired'
      ? await syncPendingInvitationState({
          invitationId: latestInvitation.id,
          email: normalizedEmail,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          jobTitle: input.jobTitle,
          roleId: role.id,
          roleCode: input.roleCode,
          authUserId,
          invitedByProfileId: actor.profileId,
          tenantId: input.tenantId,
          expiresAt,
        })
      : await createInvitation({
          tenantId: input.tenantId,
          email: normalizedEmail,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: normalizeOptionalText(input.phone),
          jobTitle: normalizeOptionalText(input.jobTitle),
          roleId: role.id,
          authUserId,
          invitedByProfileId: actor.profileId,
          expiresAt,
          metadata: {
            tenantId: input.tenantId,
            roleCode: input.roleCode,
            roleId: role.id,
          },
        })

  const redirectTo = buildInvitationCompletionUrl(input.origin, invitation.id)
  const invitationMetadata = buildInvitationMetadata({
    invitationId: invitation.id,
    tenantId: input.tenantId,
    roleCode: input.roleCode,
    roleId: role.id,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    jobTitle: input.jobTitle,
    invitedByProfileId: actor.profileId,
  })
  const adminClient = createAdminSupabaseClient()

  try {
    if (existingAuthUser) {
      await updateAuthUserMetadata(existingAuthUser.id, {
        ...(existingAuthUser.user_metadata as Record<string, unknown> | undefined),
        ...invitationMetadata,
      })

      const { error } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: {
          redirectTo,
        },
      })

      if (error) {
        throw new ValidationError(error.message)
      }
    } else {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
          redirectTo,
          data: invitationMetadata,
        }
      )

      if (error) {
        throw new ValidationError(error.message)
      }

      authUserId = data.user.id

      if (authUserId) {
        profile = await ensureProfile({
          authUserId,
          email: normalizedEmail,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        })

        tenantUser = await upsertTenantUser({
          tenantId: input.tenantId,
          profileId: profile.id,
          invitedByProfileId: actor.profileId,
          jobTitle: input.jobTitle,
          isOwner: false,
          status: 'INVITED',
          joinedAt: null,
        })

        if (tenantUser) {
          await ensurePrimaryRoleAssignment({
            tenantUserId: tenantUser.id,
            roleId: role.id,
            actorProfileId: actor.profileId,
          })
        }
      }
    }
  } catch (error) {
    await updateInvitation(invitation.id, {
      status: 'FAILED',
    })

    throw error
  }

  const updatedInvitation = await updateInvitation(invitation.id, {
    status: 'PENDING',
    sentAt: new Date(),
    authUserId,
    metadata: invitationMetadata,
  })

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actionKey:
      latestInvitation && latestInvitationStatus === 'expired'
        ? 'invite.resent'
        : 'invite.created',
    entityType: 'user_invitation',
    entityId: updatedInvitation.id,
    newValues: {
      email: normalizedEmail,
      roleCode: input.roleCode,
      tenantUserId: tenantUser?.id ?? null,
    },
  })

  return {
    invitationId: updatedInvitation.id,
    tenantUserId: tenantUser?.id ?? null,
  }
}

export async function resendTenantInvitation(
  actor: CurrentUserContext,
  invitationId: string,
  origin: string
) {
  const invitation = await findInvitationById(invitationId)

  if (!invitation) {
    throw new NotFoundError('Invitation not found.')
  }

  if (actor.activeTenantId !== invitation.tenantId) {
    throw new ForbiddenError('Tenant mismatch for invitation resend.')
  }

  const invitationStatus = invitation.status.toLowerCase() as InvitationStatusCode
  if (!canResendInvitation(invitationStatus)) {
    throw new ValidationError('Only pending or expired invitations can be resent.')
  }

  const adminClient = createAdminSupabaseClient()
  const redirectTo = buildInvitationCompletionUrl(origin, invitation.id)
  const metadata = buildInvitationMetadata({
    invitationId: invitation.id,
    tenantId: invitation.tenantId,
    roleCode: invitation.role.code,
    roleId: invitation.roleId,
    firstName: invitation.firstName ?? '',
    lastName: invitation.lastName ?? '',
    phone: invitation.phone,
    jobTitle: invitation.jobTitle,
    invitedByProfileId: invitation.invitedByProfileId,
  })
  const existingAuthUser =
    invitation.authUserId &&
    (await adminClient.auth.admin.getUserById(invitation.authUserId)).data.user

  if (existingAuthUser) {
    await updateAuthUserMetadata(existingAuthUser.id, {
      ...(existingAuthUser.user_metadata as Record<string, unknown> | undefined),
      ...metadata,
    })

    const { error } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: invitation.email,
      options: {
        redirectTo,
      },
    })

    if (error) {
      throw new ValidationError(error.message)
    }
  } else {
    const { error } = await adminClient.auth.admin.inviteUserByEmail(
      invitation.email,
      {
        redirectTo,
        data: metadata,
      }
    )

    if (error) {
      throw new ValidationError(error.message)
    }
  }

  const updatedInvitation = await updateInvitation(invitation.id, {
    status: 'PENDING',
    sentAt: new Date(),
    expiresAt: getInvitationExpiryDate(),
    metadata,
  })

  await createAuditLog({
    tenantId: invitation.tenantId,
    actorProfileId: actor.profileId,
    actionKey: 'invite.resent',
    entityType: 'user_invitation',
    entityId: invitation.id,
    newValues: {
      sentAt: updatedInvitation.sentAt?.toISOString() ?? null,
    },
  })

  return {
    invitationId: updatedInvitation.id,
  }
}

export async function revokeTenantInvitation(
  actor: CurrentUserContext,
  tenantId: string,
  invitationId: string
) {
  const invitation = await findInvitationById(invitationId)

  if (!invitation) {
    throw new NotFoundError('Invitation not found.')
  }

  if (actor.activeTenantId !== tenantId || invitation.tenantId !== tenantId) {
    throw new ForbiddenError('Tenant mismatch for invitation revoke.')
  }

  const invitationStatus = invitation.status.toLowerCase() as InvitationStatusCode
  if (invitationStatus === 'accepted') {
    throw new ValidationError('Accepted invitations cannot be revoked.')
  }

  if (invitationStatus === 'revoked') {
    throw new ValidationError('This invitation has already been revoked.')
  }

  const updatedInvitation = await updateInvitation(invitation.id, {
    status: 'REVOKED',
    revokedAt: new Date(),
  })

  await createAuditLog({
    tenantId,
    actorProfileId: actor.profileId,
    actionKey: 'invite.revoked',
    entityType: 'user_invitation',
    entityId: invitation.id,
    oldValues: {
      status: invitationStatus,
    },
    newValues: {
      status: updatedInvitation.status.toLowerCase(),
    },
  })

  return {
    invitationId: updatedInvitation.id,
  }
}

export async function acceptInvitation(
  actor: CurrentUserContext,
  input: AcceptInvitationInput
) {
  const invitation = await findInvitationById(input.invitationId)
  assertInvitationCanBeAccepted(invitation)

  if (invitation.authUserId && invitation.authUserId !== actor.authUserId) {
    throw new ForbiddenError('This invitation belongs to another account.')
  }

  if (normalizeEmail(invitation.email) !== normalizeEmail(actor.email)) {
    throw new ForbiddenError('This invitation belongs to a different email address.')
  }

  if (input.password?.trim()) {
    await setAuthUserPassword(actor.authUserId, input.password)
  }

  const profile = await ensureProfile({
    authUserId: actor.authUserId,
    email: actor.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
  })

  const existingTenantUser = await findTenantUserByTenantAndProfile(
    invitation.tenantId,
    profile.id
  )
  if (existingTenantUser && existingTenantUser.status !== 'INVITED') {
    throw new ConflictError('User already belongs to this tenant.')
  }

  const tenantUser = await upsertTenantUser({
    tenantId: invitation.tenantId,
    profileId: profile.id,
    invitedByProfileId: invitation.invitedByProfileId,
    jobTitle: invitation.jobTitle,
    isOwner: false,
    status: 'ACTIVE',
    joinedAt: new Date(),
  })

  if (!tenantUser) {
    throw new ValidationError('Tenant membership activation failed for this invitation.')
  }

  await ensurePrimaryRoleAssignment({
    tenantUserId: tenantUser.id,
    roleId: invitation.roleId,
    actorProfileId: profile.id,
  })

  await updateProfileCompletion(profile.id, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
  })
  await updateInvitation(invitation.id, {
    status: 'ACCEPTED',
    acceptedAt: new Date(),
    authUserId: actor.authUserId,
  })
  await setDefaultTenant(profile.id, invitation.tenantId)

  await createAuditLog({
    tenantId: invitation.tenantId,
    actorProfileId: profile.id,
    actionKey: 'invite.accepted',
    entityType: 'user_invitation',
    entityId: invitation.id,
    newValues: {
      tenantUserId: tenantUser.id,
      acceptedAt: new Date().toISOString(),
    },
  })

  return {
    tenantId: invitation.tenantId,
    invitationId: invitation.id,
  }
}

export async function completeInvitedProfile(
  actor: CurrentUserContext,
  authUserEmail: string,
  input: CompleteInvitedProfileInput
) {
  const invitation = await findPendingInvitationForAuthUser(actor.authUserId, authUserEmail)

  if (!invitation) {
    throw new NotFoundError('No pending invitation was found for this account.')
  }
  return acceptInvitation(actor, {
    invitationId: invitation.id,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
    password: null,
    confirmPassword: null,
  })
}

export async function updateTenantUserStatus(
  actor: CurrentUserContext,
  input: UpdateTenantUserStatusInput
) {
  const tenantUser = await findTenantUserById(input.tenantId, input.tenantUserId)

  if (!tenantUser) {
    throw new NotFoundError('Tenant user not found.')
  }

  if (actor.tenantUserId === tenantUser.id && input.status !== 'active') {
    throw new ForbiddenError('You cannot deactivate your own tenant access.')
  }

  const primaryRole = tenantUser.roles.find((role) => role.isPrimary)?.role
  if (primaryRole && getActorRank(actor) <= primaryRole.rank) {
    throw new ForbiddenError('You cannot update a user with equal or higher privilege.')
  }

  const updatedTenantUser = await prisma.tenantUser.update({
    where: {
      id: tenantUser.id,
    },
    data: {
      status: input.status.toUpperCase() as never,
      joinedAt: input.status === 'active' ? new Date() : tenantUser.joinedAt,
    },
  })

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actionKey: `tenant_user.${input.status}`,
    entityType: 'tenant_user',
    entityId: tenantUser.id,
    oldValues: {
      status: tenantUser.status.toLowerCase(),
    },
    newValues: {
      status: updatedTenantUser.status.toLowerCase(),
    },
  })

  return {
    tenantUserId: updatedTenantUser.id,
    status: updatedTenantUser.status.toLowerCase(),
  }
}

export async function changeTenantUserPrimaryRole(
  actor: CurrentUserContext,
  input: ChangeTenantUserPrimaryRoleInput
) {
  const tenantUser = await findTenantUserById(input.tenantId, input.tenantUserId)

  if (!tenantUser) {
    throw new NotFoundError('Tenant user not found.')
  }

  if (actor.tenantUserId === tenantUser.id) {
    throw new ForbiddenError('You cannot change your own primary role.')
  }

  const role = await findRoleByCode(input.roleCode)
  if (!role) {
    throw new ValidationError('Role not found.')
  }

  if (tenantUser.isOwner && role.code !== 'super_admin') {
    throw new ForbiddenError('Tenant owners must keep the super admin role.')
  }

  if (getActorRank(actor) <= role.rank) {
    throw new ForbiddenError('You cannot assign a role above your authority.')
  }

  const currentPrimaryRole = tenantUser.roles.find((userRole) => userRole.isPrimary)?.role
  await ensurePrimaryRoleAssignment({
    tenantUserId: tenantUser.id,
    roleId: role.id,
    actorProfileId: actor.profileId,
  })

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actionKey: 'role.primary_changed',
    entityType: 'tenant_user_role',
    entityId: tenantUser.id,
    oldValues: {
      roleCode: currentPrimaryRole?.code ?? null,
    },
    newValues: {
      roleCode: role.code,
    },
  })

  return {
    tenantUserId: tenantUser.id,
    roleCode: role.code,
    roleLabel: role.name,
  }
}
