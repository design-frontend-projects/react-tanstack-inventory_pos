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
      firstName: normalizeOptionalText(input.firstName),
      lastName: normalizeOptionalText(input.lastName),
      phone: normalizeOptionalText(input.phone),
      avatarUrl: normalizeOptionalText(input.avatarUrl),
      globalStatus: 'ACTIVE',
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
      firstName: normalizeOptionalText(input.firstName),
      lastName: normalizeOptionalText(input.lastName),
      phone: normalizeOptionalText(input.phone),
      avatarUrl: normalizeOptionalText(input.avatarUrl),
      onboardingCompleted: true,
    },
  })
}

export function toDisplayName(profile: {
  firstName: string | null
  lastName: string | null
  email: string
}) {
  return buildDisplayName(profile.firstName, profile.lastName, profile.email)
}
