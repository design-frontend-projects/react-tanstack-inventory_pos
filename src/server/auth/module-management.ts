import type { CurrentUserContext } from '#/types/auth'
import type {
  ModuleManagementPayload,
  ReorderScreensInput,
  SetModuleStateInput,
  SetScreenVisibilityInput,
} from '#/types/security'
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import {
  findSystemModuleById,
  findSystemScreenById,
  listSystemModulesForScreenManagement,
  listSystemScreenIdsForModule,
  listTenantModuleOverrides,
  listTenantScreenOverrides,
  setTenantModuleEnabled,
  setTenantScreenOrders,
  setTenantScreenOverride,
} from '#/server/repos/module-repo'

function assertTenantMatch(actor: CurrentUserContext, tenantId: string) {
  if (actor.activeTenantId !== tenantId) {
    throw new ForbiddenError('Tenant mismatch for module management.')
  }
}

export async function getModuleManagement(
  actor: CurrentUserContext,
  tenantId: string
): Promise<ModuleManagementPayload> {
  assertTenantMatch(actor, tenantId)

  const [modules, moduleOverrides, screenOverrides] = await Promise.all([
    listSystemModulesForScreenManagement(),
    listTenantModuleOverrides(tenantId),
    listTenantScreenOverrides(tenantId),
  ])

  const enabledByModuleId = new Map(
    moduleOverrides.map((override) => [override.moduleId, override.isEnabled])
  )
  const screenOverrideByScreenId = new Map(
    screenOverrides.map((override) => [override.screenId, override])
  )

  return {
    modules: modules.map((module) => {
      const screens = module.screens
        .map((screen) => {
          const override = screenOverrideByScreenId.get(screen.id)
          return {
            id: screen.id,
            code: screen.code,
            name: screen.name,
            path: screen.path,
            showInMenu: override?.showInMenu ?? screen.showInMenu,
            displayOrder: override?.displayOrder ?? screen.displayOrder,
            isActive: screen.isActive,
          }
        })
        .sort((left, right) => left.displayOrder - right.displayOrder)

      return {
        id: module.id,
        code: module.code,
        name: module.name,
        description: module.description,
        icon: module.icon,
        displayOrder: module.displayOrder,
        isSystem: module.isSystem,
        screenCount: screens.length,
        isEnabled: enabledByModuleId.get(module.id) ?? true,
        screens,
      }
    }),
  }
}

export async function setModuleState(
  actor: CurrentUserContext,
  input: SetModuleStateInput
) {
  assertTenantMatch(actor, input.tenantId)

  const module = await findSystemModuleById(input.moduleId)
  if (!module) {
    throw new NotFoundError('Module not found.')
  }

  await setTenantModuleEnabled(input.tenantId, input.moduleId, input.isEnabled)

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actorEmail: actor.email,
    actionKey: input.isEnabled ? 'module.enabled' : 'module.disabled',
    entityType: 'tenant_module',
    entityId: input.moduleId,
    newValues: {
      moduleCode: module.code,
      isEnabled: input.isEnabled,
    },
  })

  return { moduleId: input.moduleId, isEnabled: input.isEnabled }
}

export async function setScreenVisibility(
  actor: CurrentUserContext,
  input: SetScreenVisibilityInput
) {
  assertTenantMatch(actor, input.tenantId)

  const screen = await findSystemScreenById(input.screenId)
  if (!screen) {
    throw new NotFoundError('Screen not found.')
  }

  await setTenantScreenOverride(input.tenantId, input.screenId, {
    showInMenu: input.showInMenu,
  })

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actorEmail: actor.email,
    actionKey: input.showInMenu ? 'screen.shown' : 'screen.hidden',
    entityType: 'tenant_screen',
    entityId: input.screenId,
    newValues: {
      screenCode: screen.code,
      showInMenu: input.showInMenu,
    },
  })

  return { screenId: input.screenId, showInMenu: input.showInMenu }
}

export async function reorderScreens(
  actor: CurrentUserContext,
  input: ReorderScreensInput
) {
  assertTenantMatch(actor, input.tenantId)

  const module = await findSystemModuleById(input.moduleId)
  if (!module) {
    throw new NotFoundError('Module not found.')
  }

  const moduleScreenIds = new Set(
    await listSystemScreenIdsForModule(input.moduleId)
  )
  const allBelong = input.orderedScreenIds.every((screenId) =>
    moduleScreenIds.has(screenId)
  )
  if (!allBelong || input.orderedScreenIds.length !== moduleScreenIds.size) {
    throw new ValidationError('The provided screens do not match the module.')
  }

  await setTenantScreenOrders(input.tenantId, input.orderedScreenIds)

  await createAuditLog({
    tenantId: input.tenantId,
    actorProfileId: actor.profileId,
    actorEmail: actor.email,
    actionKey: 'screen.reordered',
    entityType: 'module',
    entityId: input.moduleId,
    newValues: {
      moduleCode: module.code,
      orderedScreenIds: input.orderedScreenIds,
    },
  })

  return { moduleId: input.moduleId }
}
