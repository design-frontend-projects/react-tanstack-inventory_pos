import type { Prisma } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'
import { normalizeEmail } from '#/server/auth/normalization'

export async function findLatestRegistrationRequestByEmail(email: string) {
  return prisma.tenantRegistrationRequest.findFirst({
    where: {
      email: normalizeEmail(email),
    },
    include: {
      linkedProfile: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function findPendingRegistrationRequestByEmail(email: string) {
  return prisma.tenantRegistrationRequest.findFirst({
    where: {
      email: normalizeEmail(email),
      status: 'PENDING',
    },
    include: {
      linkedProfile: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function findRegistrationRequestById(registrationId: string) {
  return prisma.tenantRegistrationRequest.findUnique({
    where: {
      id: registrationId,
    },
    include: {
      linkedProfile: true,
    },
  })
}

export async function createRegistrationRequest(input: {
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  activity: string
  isOwner?: boolean
  defaultRoleCode: string
  authUserId?: string | null
  linkedProfileId?: string | null
  sentAt?: Date | null
  expiresAt?: Date | null
  metadata?: Record<string, unknown>
}) {
  return prisma.tenantRegistrationRequest.create({
    data: {
      email: normalizeEmail(input.email),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      activity: input.activity,
      isOwner: input.isOwner ?? true,
      defaultRoleCode: input.defaultRoleCode,
      authUserId: input.authUserId ?? null,
      linkedProfileId: input.linkedProfileId ?? null,
      sentAt: input.sentAt ?? null,
      expiresAt: input.expiresAt ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
    include: {
      linkedProfile: true,
    },
  })
}

export async function updateRegistrationRequest(
  registrationId: string,
  data:
    | Prisma.TenantRegistrationRequestUpdateInput
    | Prisma.TenantRegistrationRequestUncheckedUpdateInput
) {
  return prisma.tenantRegistrationRequest.update({
    where: {
      id: registrationId,
    },
    data,
    include: {
      linkedProfile: true,
    },
  })
}
