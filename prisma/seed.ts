import { prisma } from '#/server/db/client'
import { PermissionKind } from '#/server/db/generated/prisma/client'
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import type { PermissionKindCode } from '#/features/auth/module-catalog'
import {
  MODULE_DEFINITIONS,
  PERMISSION_LINKS,
  SCREEN_ACTION_DEFINITIONS,
  SCREEN_DEFINITIONS,
} from '#/features/auth/module-catalog'
import {
  ACTIVITY_OPTION_DEFINITIONS,
  SUBSCRIPTION_PLAN_DEFINITIONS,
} from '#/features/owner/owner-catalog'

const PERMISSION_KIND_BY_CODE: Record<PermissionKindCode, PermissionKind> = {
  screen: PermissionKind.SCREEN,
  menu: PermissionKind.MENU,
  action: PermissionKind.ACTION,
  api: PermissionKind.API,
  data: PermissionKind.DATA,
  admin: PermissionKind.ADMIN,
}

const LEGACY_ROLE_CODE_MAP: Record<string, string> = {
  tenant_owner: 'super_admin',
  tenant_admin: 'admin',
  support_admin: 'admin',
  manager: 'res:admin',
  employee: 'res:user',
  viewer: 'res:user',
}

async function seedModules() {
  for (const definition of MODULE_DEFINITIONS) {
    const existingModule = await prisma.module.findFirst({
      where: {
        tenantId: null,
        code: definition.code,
      },
      select: {
        id: true,
      },
    })

    const data = {
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      displayOrder: definition.displayOrder,
      isSystem: true,
      isActive: true,
      isVisible: true,
      metadata: {
        titleKey: definition.titleKey,
        rootPath: definition.rootPath,
      },
    }

    if (existingModule) {
      await prisma.module.update({
        where: {
          id: existingModule.id,
        },
        data,
      })
      continue
    }

    await prisma.module.create({
      data: {
        ...data,
        tenantId: null,
        code: definition.code,
      },
    })
  }
}

async function loadSystemModuleIdByCode() {
  const modules = await prisma.module.findMany({
    where: {
      tenantId: null,
    },
    select: {
      id: true,
      code: true,
    },
  })

  return new Map(modules.map((module) => [module.code, module.id]))
}

async function loadSystemScreenIdByCode() {
  const screens = await prisma.screen.findMany({
    where: {
      tenantId: null,
    },
    select: {
      id: true,
      code: true,
    },
  })

  return new Map(screens.map((screen) => [screen.code, screen.id]))
}

async function seedScreens() {
  const moduleIdByCode = await loadSystemModuleIdByCode()

  for (const definition of SCREEN_DEFINITIONS) {
    const moduleId = moduleIdByCode.get(definition.moduleCode)

    if (!moduleId) {
      throw new Error(
        `Missing module "${definition.moduleCode}" for screen "${definition.code}"`,
      )
    }

    const existingScreen = await prisma.screen.findFirst({
      where: {
        moduleId,
        code: definition.code,
      },
      select: {
        id: true,
      },
    })

    const data = {
      name: definition.name,
      routeId: definition.path,
      path: definition.path,
      titleKey: definition.titleKey,
      icon: definition.icon,
      displayOrder: definition.displayOrder,
      showInMenu: true,
      isSystem: true,
      isActive: true,
      metadata: { keywords: [...definition.keywords] },
    }

    if (existingScreen) {
      await prisma.screen.update({
        where: {
          id: existingScreen.id,
        },
        data,
      })
      continue
    }

    await prisma.screen.create({
      data: {
        ...data,
        moduleId,
        tenantId: null,
        code: definition.code,
      },
    })
  }
}

async function seedScreenActions() {
  const screenIdByCode = await loadSystemScreenIdByCode()

  for (const definition of SCREEN_ACTION_DEFINITIONS) {
    const screenId = screenIdByCode.get(definition.screenCode)

    if (!screenId) {
      throw new Error(
        `Missing screen "${definition.screenCode}" for action "${definition.code}"`,
      )
    }

    const existingAction = await prisma.screenAction.findFirst({
      where: {
        screenId,
        code: definition.code,
      },
      select: {
        id: true,
      },
    })

    const data = {
      name: definition.name,
      actionKey: definition.actionKey,
      description: definition.description,
      displayOrder: definition.displayOrder,
      isSystem: true,
      isActive: true,
    }

    if (existingAction) {
      await prisma.screenAction.update({
        where: {
          id: existingAction.id,
        },
        data,
      })
      continue
    }

    await prisma.screenAction.create({
      data: {
        ...data,
        screenId,
        tenantId: null,
        code: definition.code,
      },
    })
  }
}

async function seedPermissions() {
  const moduleIdByCode = await loadSystemModuleIdByCode()
  const screenIdByCode = await loadSystemScreenIdByCode()
  const screenActions = await prisma.screenAction.findMany({
    where: {
      tenantId: null,
    },
    select: {
      id: true,
      code: true,
    },
  })
  const actionIdByCode = new Map(
    screenActions.map((action) => [action.code, action.id]),
  )

  for (const definition of PERMISSION_DEFINITIONS) {
    const link = PERMISSION_LINKS[definition.code]
    const moduleId = moduleIdByCode.get(link.moduleCode) ?? null
    const screenId = link.screenCode
      ? (screenIdByCode.get(link.screenCode) ?? null)
      : null
    const actionId = link.actionCode
      ? (actionIdByCode.get(link.actionCode) ?? null)
      : null

    const data = {
      name: definition.name,
      moduleKey: definition.moduleKey,
      actionKey: definition.actionKey,
      description: definition.description,
      kind: PERMISSION_KIND_BY_CODE[link.kind],
      moduleId,
      screenId,
      actionId,
      isSystem: true,
      isActive: true,
    }

    await prisma.permission.upsert({
      where: {
        code: definition.code,
      },
      update: data,
      create: {
        ...data,
        code: definition.code,
      },
    })
  }
}

async function linkScreenDefaultPermissions() {
  const screenIdByCode = await loadSystemScreenIdByCode()
  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
    },
  })
  const permissionIdByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  )

  for (const definition of SCREEN_DEFINITIONS) {
    if (!definition.defaultPermissionCode) {
      continue
    }

    const screenId = screenIdByCode.get(definition.code)
    const permissionId = permissionIdByCode.get(
      definition.defaultPermissionCode,
    )

    if (!screenId || !permissionId) {
      continue
    }

    await prisma.screen.update({
      where: {
        id: screenId,
      },
      data: {
        defaultPermissionId: permissionId,
      },
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

async function reassignRoleReferences(
  sourceRoleId: string,
  targetRoleId: string,
) {
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
              existingTargetRole.assignedByProfileId ??
              tenantUserRole.assignedByProfileId,
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
    canonicalRoles.map((role) => [role.code, role.id]),
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
    const targetRoleId =
      canonicalRoleIdByCode.get(mappedRoleCode) ?? fallbackRoleId

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
    permissions.map((permission) => [permission.code, permission.id]),
  )

  const grants: Array<{ roleId: string; permissionId: string }> = []

  for (const role of roles) {
    const permissionCodes =
      ROLE_PERMISSION_MAP[role.code as keyof typeof ROLE_PERMISSION_MAP]

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionIdByCode.get(permissionCode)

      if (!permissionId) {
        throw new Error(`Missing permission seed for code "${permissionCode}"`)
      }

      grants.push({ roleId: role.id, permissionId })
    }
  }

  // One round trip instead of ~1000 sequential upserts. The upserts carried an
  // empty update payload, so insert-if-missing (skipDuplicates) is semantically
  // identical — and the long-lived Supabase pooler connection no longer has
  // minutes of exposure in which to drop mid-loop.
  await prisma.rolePermission.createMany({
    data: grants,
    skipDuplicates: true,
  })
}

async function cleanupStalePermissions() {
  const currentPermissionCodes = PERMISSION_DEFINITIONS.map(
    (definition) => definition.code,
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

async function seedOwnerActivityOptions() {
  for (const definition of ACTIVITY_OPTION_DEFINITIONS) {
    await prisma.ownerActivityOption.upsert({
      where: {
        code: definition.code,
      },
      update: {
        name: definition.name,
        nameAr: definition.nameAr,
        description: definition.description,
        displayOrder: definition.displayOrder,
        isActive: true,
        deletedAt: null,
      },
      create: {
        code: definition.code,
        name: definition.name,
        nameAr: definition.nameAr,
        description: definition.description,
        displayOrder: definition.displayOrder,
      },
    })
  }
}

async function seedOwnerSubscriptionPlans() {
  for (const planDefinition of SUBSCRIPTION_PLAN_DEFINITIONS) {
    const plan = await prisma.ownerSubscriptionPlan.upsert({
      where: {
        code: planDefinition.code,
      },
      update: {
        name: planDefinition.name,
        description: planDefinition.description,
        priceMonthly: planDefinition.priceMonthly,
        priceYearly: planDefinition.priceYearly,
        currency: planDefinition.currency,
        trialDays: planDefinition.trialDays,
        isDefault: planDefinition.isDefault,
        displayOrder: planDefinition.displayOrder,
        isActive: true,
        deletedAt: null,
      },
      create: {
        code: planDefinition.code,
        name: planDefinition.name,
        description: planDefinition.description,
        priceMonthly: planDefinition.priceMonthly,
        priceYearly: planDefinition.priceYearly,
        currency: planDefinition.currency,
        trialDays: planDefinition.trialDays,
        isDefault: planDefinition.isDefault,
        displayOrder: planDefinition.displayOrder,
      },
    })

    for (const featureDefinition of planDefinition.features) {
      await prisma.ownerSubscriptionPlanFeature.upsert({
        where: {
          planId_code: {
            planId: plan.id,
            code: featureDefinition.code,
          },
        },
        update: {
          name: featureDefinition.name,
          description: featureDefinition.description,
          isIncluded: featureDefinition.isIncluded,
          limitValue: featureDefinition.limitValue,
          displayOrder: featureDefinition.displayOrder,
        },
        create: {
          planId: plan.id,
          code: featureDefinition.code,
          name: featureDefinition.name,
          description: featureDefinition.description,
          isIncluded: featureDefinition.isIncluded,
          limitValue: featureDefinition.limitValue,
          displayOrder: featureDefinition.displayOrder,
        },
      })
    }
  }
}

// Spec 005: a default per-tenant purchase-order approval workflow so procurement
// has amount-gated sign-off out of the box. Idempotent by (tenantId, code); the
// step routes to the tenant admin role above a threshold.
async function seedDefaultApprovalWorkflows() {
  const tenants = await prisma.tenantAccount.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })

  for (const tenant of tenants) {
    const existing = await prisma.podApprovalWorkflow.findFirst({
      where: { tenantId: tenant.id, code: 'PO-DEFAULT', deletedAt: null },
      select: { id: true },
    })

    if (existing) {
      continue
    }

    await prisma.podApprovalWorkflow.create({
      data: {
        tenantId: tenant.id,
        code: 'PO-DEFAULT',
        name: 'Purchase Order Approval',
        entityType: 'purchase_order',
        autoApprove: false,
        notes:
          'Default single-level approval; POs of 1,000+ require admin sign-off.',
        steps: {
          create: [
            {
              tenantId: tenant.id,
              stepOrder: 1,
              name: 'Admin approval',
              approverRoleCode: 'admin',
              minAmount: 1000,
              isFinal: true,
              allowDelegate: true,
            },
          ],
        },
      },
    })
  }
}

// Every seed step is idempotent (upserts / insert-if-missing), so a step that
// dies on a dropped pooler connection can simply run again — the pg pool
// replaces the dead client on the next query. Non-connection errors rethrow.
async function runStep(name: string, step: () => Promise<void>) {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await step()
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isTransient =
        /connection|ECONNRESET|terminated|not queryable|Can't reach/i.test(
          message,
        )

      if (!isTransient || attempt === maxAttempts) {
        throw error
      }

      console.warn(
        `Seed step "${name}" hit a connection drop (attempt ${attempt}/${maxAttempts}); retrying…`,
      )
    }
  }
}

async function main() {
  await runStep('modules', seedModules)
  await runStep('screens', seedScreens)
  await runStep('screen actions', seedScreenActions)
  await runStep('permissions', seedPermissions)
  await runStep('screen default permissions', linkScreenDefaultPermissions)
  await runStep('roles', seedRoles)
  await runStep('legacy roles', migrateLegacyRoles)
  await runStep('role permissions', seedRolePermissions)
  await runStep('stale permission cleanup', cleanupStalePermissions)
  await runStep('owner activity options', seedOwnerActivityOptions)
  await runStep('owner subscription plans', seedOwnerSubscriptionPlans)
  await runStep('default approval workflows', seedDefaultApprovalWorkflows)

  console.log('Seeded auth/RBAC + owner-tier foundation data.')
}

void main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
