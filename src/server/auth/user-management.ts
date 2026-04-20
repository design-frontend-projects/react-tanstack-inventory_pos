import { prisma } from '#/server/db/client'
import {
  getRoleRank,
  isTenantAssignableRole,
} from '#/features/auth/rbac-catalog'
import { canResendInvitation } from '#/features/auth/invitations'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type {
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
  activateTenantUser,
  createPendingTenantUser,
  findTenantUserById,
  findTenantUserByTenantAndProfile,
} from '#/server/repos/membership-repo'
import type { TenantUserAccessRecord } from '#/server/repos/membership-repo'
import { ensurePreferenceProfile, setDefaultTenant } from '#/server/repos/preference-repo'
import { findRoleByCode } from '#/server/repos/role-repo'
import {
  ensureProfile,
  findProfileByAuthUserId,
  updateProfileCompletion,
} from '#/server/repos/profile-repo'

async function findAuthUserByEmail(email: string) {
  const adminClient = createAdminSupabaseClient()
  let page = 1

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw new ValidationError(error.message)
    }

    const matchingUser = data.users.find(
      (user) => normalizeEmail(user.email ?? '') === normalizeEmail(email)
    )

    if (matchingUser) {
      return matchingUser
    }

    if (data.users.length < 200) {
      break
    }

    page += 1
  }

  return null
}

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
    metadata: {
      tenantId: input.tenantId,
      roleCode: input.roleCode,
      roleId: input.roleId,
    },
  })
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

  let tenantUser = existingTenantUser

  const redirectTo = new URL('/complete-profile', input.origin).toString()
  const adminClient = createAdminSupabaseClient()

  let authUserId = existingAuthUser?.id ?? profile?.authUserId ?? null

  if (existingAuthUser) {
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
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          phone: normalizeOptionalText(input.phone),
          job_title: normalizeOptionalText(input.jobTitle),
          tenant_id: input.tenantId,
          role_code: input.roleCode,
          invited_by: actor.profileId,
        },
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
    }
  }

  if (!profile) {
    throw new ValidationError('Profile provisioning failed for the invited user.')
  }

  if (!tenantUser) {
    tenantUser = await createPendingTenantUser({
      tenantId: input.tenantId,
      profileId: profile.id,
      invitedByProfileId: actor.profileId,
      jobTitle: input.jobTitle,
    })
  }

  if (!tenantUser) {
    throw new ValidationError('Tenant membership provisioning failed for the invited user.')
  }

  if (
    (tenantUser.jobTitle ?? null) !== normalizeOptionalText(input.jobTitle) ||
    tenantUser.invitedByProfileId !== actor.profileId
  ) {
    tenantUser = await prisma.tenantUser.update({
      where: {
        id: tenantUser.id,
      },
      data: {
        jobTitle: normalizeOptionalText(input.jobTitle),
        invitedByProfileId: actor.profileId,
      },
      include: {
        tenant: true,
        profile: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'desc' }],
        },
      },
    })
  }

  await ensurePrimaryRoleAssignment({
    tenantUserId: tenantUser.id,
    roleId: role.id,
    actorProfileId: actor.profileId,
  })

  const latestInvitationStatus = latestInvitation?.status
    .toLowerCase() as InvitationStatusCode | undefined

  if (latestInvitation && canResendInvitation(latestInvitationStatus)) {
    await syncPendingInvitationState({
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
    })

    return resendTenantInvitation(actor, latestInvitation.id, input.origin)
  }

  const invitation = await createInvitation({
        tenantId: input.tenantId,
        email: normalizedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: normalizeOptionalText(input.phone),
        jobTitle: normalizeOptionalText(input.jobTitle),
        roleId: role.id,
        authUserId,
        invitedByProfileId: actor.profileId,
        sentAt: new Date(),
        metadata: {
          tenantId: input.tenantId,
          roleCode: input.roleCode,
          roleId: role.id,
        },
      })

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actionKey: 'invite.created',
    entityType: 'user_invitation',
    entityId: invitation.id,
    newValues: {
      email: normalizedEmail,
      roleCode: input.roleCode,
      tenantUserId: tenantUser.id,
    },
  })

  return {
    invitationId: invitation.id,
    tenantUserId: tenantUser.id,
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
  const redirectTo = new URL('/complete-profile', origin).toString()
  const existingAuthUser =
    invitation.authUserId &&
    (await adminClient.auth.admin.getUserById(invitation.authUserId)).data.user

  if (existingAuthUser) {
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
      }
    )

    if (error) {
      throw new ValidationError(error.message)
    }
  }

  const updatedInvitation = await updateInvitation(invitation.id, {
    status: 'PENDING',
    sentAt: new Date(),
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

export async function completeInvitedProfile(
  actor: CurrentUserContext,
  authUserEmail: string,
  input: CompleteInvitedProfileInput
) {
  const invitation = await findPendingInvitationForAuthUser(actor.authUserId, authUserEmail)

  if (!invitation) {
    throw new NotFoundError('No pending invitation was found for this account.')
  }

  const profile = await ensureProfile({
    authUserId: actor.authUserId,
    email: authUserEmail,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
  })

  let tenantUser: TenantUserAccessRecord | null = await findTenantUserByTenantAndProfile(
    invitation.tenantId,
    profile.id
  )
  if (!tenantUser) {
    tenantUser = await createPendingTenantUser({
      tenantId: invitation.tenantId,
      profileId: profile.id,
      invitedByProfileId: invitation.invitedByProfileId,
      jobTitle: invitation.jobTitle,
    })
  }

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
  await activateTenantUser(tenantUser.id)
  await updateInvitation(invitation.id, {
    status: 'ACCEPTED',
    acceptedAt: new Date(),
    authUserId: actor.authUserId,
  })

  const preferenceProfile = await ensurePreferenceProfile(profile.id)
  if (!preferenceProfile.defaultTenantId) {
    await setDefaultTenant(profile.id, invitation.tenantId)
  }

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
  }
}

export async function updateTenantUserStatus(
  actor: CurrentUserContext,
  input: UpdateTenantUserStatusInput
) {
  const tenantUser = await findTenantUserById(input.tenantId, input.tenantUserId)

  if (!tenantUser) {
    throw new NotFoundError('Tenant user not found.')
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

  const role = await findRoleByCode(input.roleCode)
  if (!role) {
    throw new ValidationError('Role not found.')
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
