import { prisma } from '#/server/db/client'
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'

const LEGACY_ROLE_CODE_MAP: Record<string, string> = {
  tenant_owner: 'super_admin',
  tenant_admin: 'admin',
  support_admin: 'admin',
  manager: 'res:admin',
  employee: 'res:user',
  viewer: 'res:user',
}

async function seedPermissions() {
  for (const definition of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: {
        code: definition.code,
      },
      update: {
        name: definition.name,
        moduleKey: definition.moduleKey,
        actionKey: definition.actionKey,
        description: definition.description,
      },
      create: definition,
    })
  }
}

async function seedRoles() {
  for (const definition of ROLE_DEFINITIONS) {
    const existingRole = await prisma.role.findFirst({
      where: {
        tenantId: null,
        code: definition.code,
      },
      select: {
        id: true,
      },
    })

    if (existingRole) {
      await prisma.role.update({
        where: {
          id: existingRole.id,
        },
        data: {
          name: definition.name,
          description: definition.description,
          isSystem: definition.isSystem,
          isActive: true,
          rank: definition.rank,
        },
      })
      continue
    }

    await prisma.role.create({
      data: {
        ...definition,
        tenantId: null,
        isActive: true,
      },
    })
  }
}

async function reassignRoleReferences(sourceRoleId: string, targetRoleId: string) {
  const tenantUserRoles = await prisma.tenantUserRole.findMany({
    where: {
      roleId: sourceRoleId,
    },
  })

  for (const tenantUserRole of tenantUserRoles) {
    const existingTargetRole = await prisma.tenantUserRole.findFirst({
      where: {
        tenantUserId: tenantUserRole.tenantUserId,
        roleId: targetRoleId,
      },
    })

    if (existingTargetRole) {
      if (tenantUserRole.isPrimary && !existingTargetRole.isPrimary) {
        await prisma.tenantUserRole.update({
          where: {
            id: existingTargetRole.id,
          },
          data: {
            isPrimary: true,
            assignedByProfileId:
              existingTargetRole.assignedByProfileId ?? tenantUserRole.assignedByProfileId,
            assignedAt:
              existingTargetRole.assignedAt > tenantUserRole.assignedAt
                ? existingTargetRole.assignedAt
                : tenantUserRole.assignedAt,
          },
        })
      }

      await prisma.tenantUserRole.delete({
        where: {
          id: tenantUserRole.id,
        },
      })
      continue
    }

    await prisma.tenantUserRole.update({
      where: {
        id: tenantUserRole.id,
      },
      data: {
        roleId: targetRoleId,
      },
    })
  }

  await prisma.user_invitations.updateMany({
    where: {
      roleId: sourceRoleId,
    },
    data: {
      roleId: targetRoleId,
    },
  })
}

async function migrateLegacyRoles() {
  const canonicalRoles = await prisma.role.findMany({
    where: {
      tenantId: null,
      code: {
        in: ROLE_DEFINITIONS.map((definition) => definition.code),
      },
    },
    select: {
      id: true,
      code: true,
    },
  })
  const canonicalRoleIdByCode = new Map(
    canonicalRoles.map((role) => [role.code, role.id])
  )

  const staleSystemRoles = await prisma.role.findMany({
    where: {
      tenantId: null,
      code: {
        notIn: ROLE_DEFINITIONS.map((definition) => definition.code),
      },
    },
    select: {
      id: true,
      code: true,
    },
  })

  const fallbackRoleId = canonicalRoleIdByCode.get('res:user')
  if (!fallbackRoleId) {
    throw new Error('Fallback role res:user is missing.')
  }

  for (const staleRole of staleSystemRoles) {
    const mappedRoleCode = LEGACY_ROLE_CODE_MAP[staleRole.code] ?? 'res:user'
    const targetRoleId = canonicalRoleIdByCode.get(mappedRoleCode) ?? fallbackRoleId

    if (staleRole.code === 'tenant_owner') {
      const ownerAssignments = await prisma.tenantUserRole.findMany({
        where: {
          roleId: staleRole.id,
        },
        select: {
          tenantUserId: true,
        },
      })

      if (ownerAssignments.length > 0) {
        await prisma.tenantUser.updateMany({
          where: {
            id: {
              in: ownerAssignments.map((assignment) => assignment.tenantUserId),
            },
          },
          data: {
            isOwner: true,
          },
        })
      }
    }

    await reassignRoleReferences(staleRole.id, targetRoleId)
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: staleRole.id,
      },
    })
    await prisma.role.delete({
      where: {
        id: staleRole.id,
      },
    })
  }
}

async function seedRolePermissions() {
  const roles = await prisma.role.findMany({
    where: {
      tenantId: null,
    },
    select: {
      id: true,
      code: true,
    },
  })

  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
    },
  })

  const permissionIdByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id])
  )

  for (const role of roles) {
    const permissionCodes =
      ROLE_PERMISSION_MAP[role.code as keyof typeof ROLE_PERMISSION_MAP]

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionIdByCode.get(permissionCode)

      if (!permissionId) {
        throw new Error(`Missing permission seed for code "${permissionCode}"`)
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId,
        },
      })
    }
  }
}

async function cleanupStalePermissions() {
  const currentPermissionCodes = PERMISSION_DEFINITIONS.map(
    (definition) => definition.code
  )
  const stalePermissions = await prisma.permission.findMany({
    where: {
      code: {
        notIn: currentPermissionCodes,
      },
    },
    select: {
      id: true,
    },
  })

  if (stalePermissions.length === 0) {
    return
  }

  const stalePermissionIds = stalePermissions.map((permission) => permission.id)

  await prisma.tenantUserPermission.deleteMany({
    where: {
      permissionId: {
        in: stalePermissionIds,
      },
    },
  })
  await prisma.rolePermission.deleteMany({
    where: {
      permissionId: {
        in: stalePermissionIds,
      },
    },
  })
  await prisma.permission.deleteMany({
    where: {
      id: {
        in: stalePermissionIds,
      },
    },
  })
}

async function main() {
  await seedPermissions()
  await seedRoles()
  await migrateLegacyRoles()
  await seedRolePermissions()
  await cleanupStalePermissions()

  console.log('Seeded auth/RBAC foundation data.')
}

void main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
