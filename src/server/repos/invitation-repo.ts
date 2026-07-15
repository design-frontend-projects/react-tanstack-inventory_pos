import type { Prisma } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'
import { normalizeEmail } from '#/server/auth/normalization'

export async function findLatestInvitationForTenantEmail(
  tenantId: string,
  email: string
) {
  return prisma.user_invitations.findFirst({
    where: {
      tenantId,
      email: normalizeEmail(email),
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function findPendingInvitationForTenantEmail(
  tenantId: string,
  email: string
) {
  return prisma.user_invitations.findFirst({
    where: {
      tenantId,
      email: normalizeEmail(email),
      status: 'PENDING',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function createInvitation(input: {
  tenantId: string
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  jobTitle?: string | null
  roleId: string
  authUserId?: string | null
  invitedByProfileId: string
  sentAt?: Date
  expiresAt?: Date | null
  metadata?: Record<string, unknown>
}) {
  return prisma.user_invitations.create({
    data: {
      tenantId: input.tenantId,
      email: normalizeEmail(input.email),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      jobTitle: input.jobTitle ?? null,
      roleId: input.roleId,
      authUserId: input.authUserId ?? null,
      invitedByProfileId: input.invitedByProfileId,
      sentAt: input.sentAt ?? new Date(),
      expiresAt: input.expiresAt ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })
}

export async function updateInvitation(invitationId: string, data: object) {
  return prisma.user_invitations.update({
    where: {
      id: invitationId,
    },
    data,
  })
}

export async function findPendingInvitationForAuthUser(
  authUserId: string,
  email: string
) {
  return prisma.user_invitations.findFirst({
    where: {
      OR: [
        {
          authUserId,
        },
        {
          email: normalizeEmail(email),
        },
      ],
      status: 'PENDING',
    },
    include: {
      role: true,
      tenant: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function listLatestInvitationsForTenant(tenantId: string) {
  return prisma.user_invitations.findMany({
    where: {
      tenantId,
    },
    include: {
      role: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function findInvitationById(invitationId: string) {
  return prisma.user_invitations.findUnique({
    where: {
      id: invitationId,
    },
    include: {
      role: true,
      tenant: true,
      invitedByProfile: true,
    },
  })
}
