import { prisma } from '#/server/db/client'

export async function findPermissionByCode(permissionCode: string) {
  return prisma.permission.findUnique({
    where: {
      code: permissionCode,
    },
  })
}

export async function listPermissions() {
  return prisma.permission.findMany({
    orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
  })
}

export async function findPermissionsByCodes(codes: Array<string>) {
  return prisma.permission.findMany({
    where: {
      code: {
        in: codes,
      },
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
    },
  })
}

export async function setTenantUserPermissionOverride(input: {
  tenantUserId: string
  permissionId: string
  isAllowed: boolean | null
  assignedByProfileId: string
}) {
  if (input.isAllowed === null) {
    return prisma.tenantUserPermission.deleteMany({
      where: {
        tenantUserId: input.tenantUserId,
        permissionId: input.permissionId,
      },
    })
  }

  return prisma.tenantUserPermission.upsert({
    where: {
      tenantUserId_permissionId: {
        tenantUserId: input.tenantUserId,
        permissionId: input.permissionId,
      },
    },
    update: {
      isAllowed: input.isAllowed,
      assignedByProfileId: input.assignedByProfileId,
    },
    create: {
      tenantUserId: input.tenantUserId,
      permissionId: input.permissionId,
      isAllowed: input.isAllowed,
      assignedByProfileId: input.assignedByProfileId,
    },
    include: {
      permission: true,
    },
  })
}
