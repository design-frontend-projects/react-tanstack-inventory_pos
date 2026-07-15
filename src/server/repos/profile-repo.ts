import { prisma } from '#/server/db/client'
import {
  buildDisplayName,
  normalizeEmail,
  normalizeOptionalText,
} from '#/server/auth/normalization'

type EnsureProfileInput = {
  authUserId: string
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  avatarUrl?: string | null
}

function buildProfileUpdateData(
  input: Omit<EnsureProfileInput, 'authUserId' | 'email'>
) {
  return {
    ...(input.firstName !== undefined
      ? { firstName: normalizeOptionalText(input.firstName) }
      : {}),
    ...(input.lastName !== undefined
      ? { lastName: normalizeOptionalText(input.lastName) }
      : {}),
    ...(input.phone !== undefined ? { phone: normalizeOptionalText(input.phone) } : {}),
    ...(input.avatarUrl !== undefined
      ? { avatarUrl: normalizeOptionalText(input.avatarUrl) }
      : {}),
  }
}

export async function findProfileByAuthUserId(authUserId: string) {
  return prisma.profile.findUnique({
    where: {
      authUserId,
    },
    include: {
      preferenceProfile: true,
    },
  })
}

export async function ensureProfile(input: EnsureProfileInput) {
  const normalizedEmail = normalizeEmail(input.email)

  return prisma.profile.upsert({
    where: {
      authUserId: input.authUserId,
    },
    update: {
      email: normalizedEmail,
      globalStatus: 'ACTIVE',
      ...buildProfileUpdateData(input),
    },
    create: {
      authUserId: input.authUserId,
      email: normalizedEmail,
      firstName: normalizeOptionalText(input.firstName),
      lastName: normalizeOptionalText(input.lastName),
      phone: normalizeOptionalText(input.phone),
      avatarUrl: normalizeOptionalText(input.avatarUrl),
    },
    include: {
      preferenceProfile: true,
    },
  })
}

export async function updateProfileCompletion(
  profileId: string,
  input: Omit<EnsureProfileInput, 'authUserId' | 'email'>
) {
  return prisma.profile.update({
    where: {
      id: profileId,
    },
    data: {
      ...buildProfileUpdateData(input),
      profileCompleted: true,
      onboardingCompleted: true,
    },
  })
}

export async function updateProfile(
  profileId: string,
  input: Omit<EnsureProfileInput, 'authUserId' | 'email'>
) {
  return prisma.profile.update({
    where: {
      id: profileId,
    },
    data: buildProfileUpdateData(input),
  })
}

export function toDisplayName(profile: {
  firstName: string | null
  lastName: string | null
  email: string
}) {
  return buildDisplayName(profile.firstName, profile.lastName, profile.email)
}
