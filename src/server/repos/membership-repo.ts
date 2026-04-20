import type { Prisma } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'

export type ProfileTenantMembership = Prisma.TenantUserGetPayload<{
  include: {
    tenant: true
    roles: {
      include: {
        role: true
      }
    }
  }
}>

export type TenantUserAccessRecord = Prisma.TenantUserGetPayload<{
  include: {
    tenant: true
    profile: true
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    }
  }
}>

export type TenantUserSummaryRecord = Prisma.TenantUserGetPayload<{
  include: {
    profile: true
    roles: {
      include: {
        role: true
      }
    }
  }
}>

export async function listTenantUsersForProfile(profileId: string) {
  return prisma.tenantUser.findMany({
    where: {
      profileId,
    },
    include: {
      tenant: true,
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
    orderBy: {
      createdAt: 'asc',
    },
  })
}

export async function findTenantUserByTenantAndProfile(
  tenantId: string,
  profileId: string
) {
  return prisma.tenantUser.findUnique({
    where: {
      tenantId_profileId: {
        tenantId,
        profileId,
      },
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

export async function findTenantUserById(tenantId: string, tenantUserId: string) {
  return prisma.tenantUser.findFirst({
    where: {
      id: tenantUserId,
      tenantId,
    },
    include: {
      profile: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  })
}

export async function setTenantUserStatus(
  _tenantId: string,
  tenantUserId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'
) {
  return prisma.tenantUser.update({
    where: {
      id: tenantUserId,
    },
    data: {
      status,
      joinedAt: status === 'ACTIVE' ? new Date() : undefined,
    },
    include: {
      profile: true,
      roles: {
        include: {
          role: true,
        },
        orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'desc' }],
      },
    },
  })
}

export async function createPendingTenantUser(input: {
  tenantId: string
  profileId: string
  invitedByProfileId: string
  jobTitle?: string | null
}) {
  await prisma.tenantUser.create({
    data: {
      tenantId: input.tenantId,
      profileId: input.profileId,
      invitedByProfileId: input.invitedByProfileId,
      jobTitle: input.jobTitle ?? null,
      status: 'INVITED',
    },
  })

  return findTenantUserByTenantAndProfile(input.tenantId, input.profileId)
}

export async function activateTenantUser(tenantUserId: string) {
  return prisma.tenantUser.update({
    where: {
      id: tenantUserId,
    },
    data: {
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  })
}

export async function listTenantUsers(
  tenantId: string,
  filters?: {
    search?: string
    status?: string
    roleCode?: string
    invitationStatus?: string
  }
) {
  const search = filters?.search?.trim()

  return prisma.tenantUser.findMany({
    where: {
      tenantId,
      ...(filters?.status && filters.status !== 'all'
        ? { status: filters.status as never }
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
      },
      tenant: true,
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })
}
