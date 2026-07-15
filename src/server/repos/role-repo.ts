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

const assignableRoleWhere = (tenantId: string) => ({
  isActive: true,
  deletedAt: null,
  OR: [
    { tenantId: null, code: { in: TENANT_ASSIGNABLE_ROLE_CODES } },
    { tenantId },
  ],
})

// Roles a user can be assigned in a tenant: system-assignable roles + the tenant's
// own custom (non-system) roles.
export async function listAssignableRoles(tenantId: string) {
  return prisma.role.findMany({
    where: assignableRoleWhere(tenantId),
    orderBy: {
      rank: 'desc',
    },
  })
}

export async function findAssignableRoleByCode(tenantId: string, roleCode: string) {
  return prisma.role.findFirst({
    where: {
      ...assignableRoleWhere(tenantId),
      code: normalizeRoleCode(roleCode),
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

// All roles visible on the management screen: system-assignable (read-only) plus
// the tenant's custom roles (editable), including disabled ones, with permissions.
export async function listManageableRoles(tenantId: string) {
  return prisma.role.findMany({
    where: {
      deletedAt: null,
      OR: [
        { tenantId: null, code: { in: TENANT_ASSIGNABLE_ROLE_CODES } },
        { tenantId },
      ],
    },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: {
      rank: 'desc',
    },
  })
}

export async function findTenantRoleById(tenantId: string, roleId: string) {
  return prisma.role.findFirst({
    where: {
      id: roleId,
      tenantId,
      isSystem: false,
      deletedAt: null,
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

export async function findTenantRoleByCode(tenantId: string, code: string) {
  return prisma.role.findFirst({
    where: {
      tenantId,
      code,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  })
}

export async function createTenantRole(input: {
  tenantId: string
  code: string
  name: string
  description?: string | null
  rank: number
}) {
  return prisma.role.create({
    data: {
      tenantId: input.tenantId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      rank: input.rank,
      isSystem: false,
      isActive: true,
    },
  })
}

export async function updateTenantRole(
  roleId: string,
  data: {
    name?: string
    description?: string | null
    isActive?: boolean
    rank?: number
  }
) {
  return prisma.role.update({
    where: {
      id: roleId,
    },
    data,
  })
}

export async function softDeleteTenantRole(roleId: string, deletedAt: Date) {
  return prisma.role.update({
    where: {
      id: roleId,
    },
    data: {
      deletedAt,
      isActive: false,
    },
  })
}

// Replace a role's permission grants atomically.
export async function setRolePermissions(
  roleId: string,
  permissionIds: Array<string>
) {
  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({
      where: {
        roleId,
      },
    })

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      })
    }
  })
}

export async function countTenantUsersWithRole(roleId: string) {
  return prisma.tenantUserRole.count({
    where: {
      roleId,
    },
  })
}

// Number of this tenant's users assigned to each role, keyed by roleId.
export async function getRoleAssignmentCounts(tenantId: string) {
  const rows = await prisma.tenantUserRole.groupBy({
    by: ['roleId'],
    where: {
      tenantUser: {
        tenantId,
      },
    },
    _count: {
      _all: true,
    },
  })

  return new Map(rows.map((row) => [row.roleId, row._count._all]))
}

// True max rank of a tenant user's assigned roles, read from the DB so custom
// roles (absent from the code catalog) are ranked correctly.
export async function getTenantUserMaxRoleRank(tenantUserId: string) {
  const assignments = await prisma.tenantUserRole.findMany({
    where: {
      tenantUserId,
    },
    select: {
      role: {
        select: {
          rank: true,
        },
      },
    },
  })

  return assignments.reduce((max, assignment) => Math.max(max, assignment.role.rank), 0)
}
