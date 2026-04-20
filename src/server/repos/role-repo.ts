import { prisma } from '#/server/db/client'
import {
  TENANT_ASSIGNABLE_ROLE_CODES,
  normalizeRoleCode,
} from '#/features/auth/rbac-catalog'

export async function listTenantAssignableRoles() {
  return prisma.role.findMany({
    where: {
      tenantId: null,
      code: {
        in: TENANT_ASSIGNABLE_ROLE_CODES,
      },
      isActive: true,
    },
    orderBy: {
      rank: 'desc',
    },
  })
}

export async function listTenantAssignableRolesWithPermissions() {
  return prisma.role.findMany({
    where: {
      tenantId: null,
      code: {
        in: TENANT_ASSIGNABLE_ROLE_CODES,
      },
      isActive: true,
    },
    include: {
      permissions: {
        include: {
          permission: true,
        },
        orderBy: {
          permission: {
            code: 'asc',
          },
        },
      },
    },
    orderBy: {
      rank: 'desc',
    },
  })
}

export async function findRoleByCode(roleCode: string) {
  return prisma.role.findFirst({
    where: {
      code: normalizeRoleCode(roleCode),
      tenantId: null,
      isActive: true,
    },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  })
}

export async function findRoleById(roleId: string) {
  return prisma.role.findUnique({
    where: {
      id: roleId,
    },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  })
}
