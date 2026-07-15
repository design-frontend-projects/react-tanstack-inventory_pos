import type { Prisma } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'

const systemModuleWithScreens = {
  where: {
    deletedAt: null,
  },
  orderBy: {
    displayOrder: 'asc',
  },
  include: {
    screens: {
      where: {
        deletedAt: null,
      },
      orderBy: {
        displayOrder: 'asc',
      },
      include: {
        actions: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
        defaultPermission: {
          select: {
            code: true,
          },
        },
      },
    },
  },
} satisfies Prisma.ModuleFindManyArgs

export type ModuleWithScreens = Prisma.ModuleGetPayload<{
  include: (typeof systemModuleWithScreens)['include']
}>

// System (tenant-agnostic) registry: modules -> screens -> actions, active-first.
export async function listSystemModulesWithScreens(): Promise<
  Array<ModuleWithScreens>
> {
  return prisma.module.findMany({
    where: {
      tenantId: null,
      deletedAt: null,
    },
    orderBy: {
      displayOrder: 'asc',
    },
    include: systemModuleWithScreens.include,
  })
}

const navigationModuleInclude = {
  screens: {
    // showInMenu is applied in the service so per-tenant overrides can flip it
    where: {
      deletedAt: null,
      isActive: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
    include: {
      defaultPermission: {
        select: {
          code: true,
        },
      },
    },
  },
} satisfies Prisma.ModuleInclude

export type NavigationModule = Prisma.ModuleGetPayload<{
  include: typeof navigationModuleInclude
}>

// Active, visible system modules with their in-menu screens, ordered for display.
export async function listNavigationModules(): Promise<Array<NavigationModule>> {
  return prisma.module.findMany({
    where: {
      tenantId: null,
      deletedAt: null,
      isActive: true,
      isVisible: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
    include: navigationModuleInclude,
  })
}

export async function listTenantModuleOverrides(tenantId: string) {
  return prisma.tenantModule.findMany({
    where: {
      tenantId,
    },
  })
}

export async function listTenantScreenOverrides(tenantId: string) {
  return prisma.tenantScreen.findMany({
    where: {
      tenantId,
    },
  })
}

export async function listSystemModulesForScreenManagement() {
  return prisma.module.findMany({
    where: {
      tenantId: null,
      deletedAt: null,
    },
    orderBy: {
      displayOrder: 'asc',
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      icon: true,
      displayOrder: true,
      isSystem: true,
      screens: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          displayOrder: 'asc',
        },
        select: {
          id: true,
          code: true,
          name: true,
          path: true,
          showInMenu: true,
          displayOrder: true,
          isActive: true,
        },
      },
    },
  })
}

export async function findSystemScreenById(screenId: string) {
  return prisma.screen.findFirst({
    where: {
      id: screenId,
      tenantId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      moduleId: true,
    },
  })
}

export async function listSystemScreenIdsForModule(moduleId: string) {
  const screens = await prisma.screen.findMany({
    where: {
      moduleId,
      tenantId: null,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  })

  return screens.map((screen) => screen.id)
}

export async function setTenantScreenOverride(
  tenantId: string,
  screenId: string,
  data: { showInMenu?: boolean | null; displayOrder?: number | null }
) {
  return prisma.tenantScreen.upsert({
    where: {
      tenantId_screenId: {
        tenantId,
        screenId,
      },
    },
    update: data,
    create: {
      tenantId,
      screenId,
      showInMenu: data.showInMenu ?? null,
      displayOrder: data.displayOrder ?? null,
    },
  })
}

// Assign sequential display-order overrides for a set of screens atomically.
export async function setTenantScreenOrders(
  tenantId: string,
  orderedScreenIds: Array<string>
) {
  return prisma.$transaction(
    orderedScreenIds.map((screenId, index) =>
      prisma.tenantScreen.upsert({
        where: {
          tenantId_screenId: {
            tenantId,
            screenId,
          },
        },
        update: {
          displayOrder: index,
        },
        create: {
          tenantId,
          screenId,
          displayOrder: index,
        },
      })
    )
  )
}

export async function listSystemModulesForManagement() {
  return prisma.module.findMany({
    where: {
      tenantId: null,
      deletedAt: null,
    },
    orderBy: {
      displayOrder: 'asc',
    },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      icon: true,
      displayOrder: true,
      isSystem: true,
      _count: {
        select: {
          screens: true,
        },
      },
    },
  })
}

export async function findSystemModuleById(moduleId: string) {
  return prisma.module.findFirst({
    where: {
      id: moduleId,
      tenantId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  })
}

export async function setTenantModuleEnabled(
  tenantId: string,
  moduleId: string,
  isEnabled: boolean
) {
  return prisma.tenantModule.upsert({
    where: {
      tenantId_moduleId: {
        tenantId,
        moduleId,
      },
    },
    update: {
      isEnabled,
    },
    create: {
      tenantId,
      moduleId,
      isEnabled,
    },
  })
}

export async function countSystemModules() {
  return prisma.module.count({
    where: {
      tenantId: null,
      deletedAt: null,
    },
  })
}

export async function countSystemScreens() {
  return prisma.screen.count({
    where: {
      tenantId: null,
      deletedAt: null,
    },
  })
}

export async function countSystemScreenActions() {
  return prisma.screenAction.count({
    where: {
      tenantId: null,
      deletedAt: null,
    },
  })
}
