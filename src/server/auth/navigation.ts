import type { CurrentUserContext } from '#/types/auth'
import type { NavigationTree, NavModule } from '#/types/navigation'
import { ForbiddenError } from '#/server/auth/errors'
import {
  listNavigationModules,
  listTenantModuleOverrides,
  listTenantScreenOverrides,
} from '#/server/repos/module-repo'

type ModuleMetadata = {
  titleKey?: string
  rootPath?: string
}

function readModuleMetadata(value: unknown): ModuleMetadata {
  if (value && typeof value === 'object') {
    return value as ModuleMetadata
  }

  return {}
}

export async function getNavigationTree(
  actor: CurrentUserContext,
  tenantId: string
): Promise<NavigationTree> {
  if (actor.activeTenantId !== tenantId) {
    throw new ForbiddenError('Tenant mismatch for navigation.')
  }

  const [modules, moduleOverrides, screenOverrides] = await Promise.all([
    listNavigationModules(),
    listTenantModuleOverrides(tenantId),
    listTenantScreenOverrides(tenantId),
  ])

  const overrideByModuleId = new Map(
    moduleOverrides.map((override) => [override.moduleId, override])
  )
  const screenOverrideByScreenId = new Map(
    screenOverrides.map((override) => [override.screenId, override])
  )
  const permissionSet = new Set<string>(actor.permissions)

  const rankedModules: Array<{ sortOrder: number; module: NavModule }> = []

  for (const module of modules) {
    const override = overrideByModuleId.get(module.id)

    if (override?.isEnabled === false) {
      continue
    }

    const screens = module.screens
      .map((screen) => {
        const screenOverride = screenOverrideByScreenId.get(screen.id)
        return {
          screen,
          showInMenu: screenOverride?.showInMenu ?? screen.showInMenu,
          order: screenOverride?.displayOrder ?? screen.displayOrder,
        }
      })
      .filter(({ screen, showInMenu }) => {
        if (!screen.path || !showInMenu) {
          return false
        }

        const requiredPermission = screen.defaultPermission?.code

        return !requiredPermission || permissionSet.has(requiredPermission)
      })
      .sort((left, right) => left.order - right.order)
      .map(({ screen }) => ({
        id: screen.id,
        code: screen.code,
        name: screen.name,
        path: screen.path as string,
        titleKey: screen.titleKey,
        icon: screen.icon,
      }))

    if (screens.length === 0) {
      continue
    }

    const metadata = readModuleMetadata(module.metadata)

    rankedModules.push({
      sortOrder: override?.displayOrder ?? module.displayOrder,
      module: {
        id: module.id,
        code: module.code,
        name: module.name,
        titleKey: metadata.titleKey ?? null,
        icon: module.icon,
        rootPath: metadata.rootPath ?? screens[0].path,
        screens,
      },
    })
  }

  rankedModules.sort((left, right) => left.sortOrder - right.sortOrder)

  return {
    modules: rankedModules.map((ranked) => ranked.module),
  }
}
