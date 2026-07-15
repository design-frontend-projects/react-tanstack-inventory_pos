import { prisma } from '#/server/db/client'

function slugifyTenantName(tenantName: string) {
  return tenantName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function resolveUniqueTenantSlug(tenantName: string) {
  const slugifiedName = slugifyTenantName(tenantName)
  const baseSlug = slugifiedName.length > 0 ? slugifiedName : 'workspace'
  let slugCandidate = baseSlug
  let suffix = 1

  for (;;) {
    const existingTenant = await prisma.tenantAccount.findUnique({
      where: {
        slug: slugCandidate,
      },
      select: {
        id: true,
      },
    })

    if (!existingTenant) {
      return slugCandidate
    }

    suffix += 1
    slugCandidate = `${baseSlug}-${suffix}`
  }
}

export async function findTenantById(tenantId: string) {
  return prisma.tenantAccount.findUnique({
    where: {
      id: tenantId,
    },
  })
}

export async function createTenantAccount(input: {
  tenantName: string
  activity?: string | null
  activityOptionId?: string | null
  timezone?: string | null
  ownerProfileId?: string | null
}) {
  const slug = await resolveUniqueTenantSlug(input.tenantName)

  return prisma.tenantAccount.create({
    data: {
      name: input.tenantName.trim(),
      slug,
      activity: input.activity ?? null,
      activityOptionId: input.activityOptionId ?? null,
      timezone: input.timezone ?? null,
      ownerProfileId: input.ownerProfileId ?? null,
      status: 'ACTIVE',
    },
  })
}

export async function updateTenantAccount(
  tenantId: string,
  data: {
    name?: string
    activity?: string | null
    activityOptionId?: string | null
    timezone?: string | null
    ownerProfileId?: string | null
  }
) {
  return prisma.tenantAccount.update({
    where: {
      id: tenantId,
    },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.activity !== undefined ? { activity: data.activity ?? null } : {}),
      ...(data.activityOptionId !== undefined
        ? { activityOptionId: data.activityOptionId ?? null }
        : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone ?? null } : {}),
      ...(data.ownerProfileId !== undefined
        ? { ownerProfileId: data.ownerProfileId ?? null }
        : {}),
    },
  })
}
