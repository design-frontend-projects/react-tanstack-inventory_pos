import { prisma } from '#/server/db/client'
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'

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

async function main() {
  await seedPermissions()
  await seedRoles()
  await seedRolePermissions()

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
