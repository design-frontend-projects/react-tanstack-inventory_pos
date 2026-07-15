import type { CurrentUserContext } from '#/types/auth'
import type {
  SecurityOverviewPayload,
  SecurityPermissionKind,
} from '#/types/security'
import { prisma } from '#/server/db/client'
import { ForbiddenError } from '#/server/auth/errors'
import {
  countSystemModules,
  countSystemScreenActions,
  countSystemScreens,
  listSystemModulesWithScreens,
} from '#/server/repos/module-repo'
import { listRecentAuditLogs } from '#/server/repos/audit-log-repo'
import { listPermissions } from '#/server/repos/permission-repo'

export async function getSecurityOverview(
  actor: CurrentUserContext,
  tenantId: string
): Promise<SecurityOverviewPayload> {
  if (actor.activeTenantId !== tenantId) {
    throw new ForbiddenError('Tenant mismatch for security overview.')
  }

  const [
    modules,
    permissions,
    recentAudit,
    moduleCount,
    screenCount,
    actionCount,
    permissionCount,
    roleCount,
    userCount,
  ] = await Promise.all([
    listSystemModulesWithScreens(),
    listPermissions(),
    listRecentAuditLogs(tenantId),
    countSystemModules(),
    countSystemScreens(),
    countSystemScreenActions(),
    prisma.permission.count({ where: { deletedAt: null } }),
    prisma.role.count({
      where: { tenantId: null, isActive: true, deletedAt: null },
    }),
    prisma.tenantUser.count({ where: { tenantId } }),
  ])

  return {
    counts: {
      modules: moduleCount,
      screens: screenCount,
      actions: actionCount,
      permissions: permissionCount,
      roles: roleCount,
      users: userCount,
    },
    modules: modules.map((module) => ({
      id: module.id,
      code: module.code,
      name: module.name,
      description: module.description,
      icon: module.icon,
      displayOrder: module.displayOrder,
      isActive: module.isActive,
      screens: module.screens.map((screen) => ({
        id: screen.id,
        code: screen.code,
        name: screen.name,
        path: screen.path,
        icon: screen.icon,
        displayOrder: screen.displayOrder,
        showInMenu: screen.showInMenu,
        isActive: screen.isActive,
        defaultPermissionCode: screen.defaultPermission?.code ?? null,
        actions: screen.actions.map((action) => ({
          id: action.id,
          code: action.code,
          name: action.name,
          actionKey: action.actionKey,
          isActive: action.isActive,
        })),
      })),
    })),
    permissions: permissions.map((permission) => ({
      code: permission.code,
      name: permission.name,
      kind: permission.kind.toLowerCase() as SecurityPermissionKind,
      moduleKey: permission.moduleKey,
      actionKey: permission.actionKey,
      description: permission.description,
      isActive: permission.isActive,
    })),
    recentAudit: recentAudit.map((entry) => ({
      id: entry.id,
      actionKey: entry.actionKey,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorEmail: entry.actorEmail,
      createdAt: entry.createdAt.toISOString(),
    })),
  }
}
