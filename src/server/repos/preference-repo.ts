import { prisma } from '#/server/db/client'

export async function ensurePreferenceProfile(profileId: string) {
  return prisma.preferenceProfile.upsert({
    where: {
      profileId,
    },
    update: {},
    create: {
      profileId,
    },
  })
}

export async function setDefaultTenant(profileId: string, tenantId: string | null) {
  return prisma.preferenceProfile.upsert({
    where: {
      profileId,
    },
    update: {
      defaultTenantId: tenantId,
    },
    create: {
      profileId,
      defaultTenantId: tenantId,
    },
  })
}
