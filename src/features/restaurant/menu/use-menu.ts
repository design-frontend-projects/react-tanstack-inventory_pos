'use client'

import { useQuery } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  getMenuItemOrderingDetailServerFn,
  listCategoriesServerFn,
  listMenuItemsServerFn,
  listMenusServerFn,
} from '#/features/restaurant/menu/server-functions'
import { listKitchenStationsServerFn } from '#/features/restaurant/master-data/server-functions'

export function useMenus(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-menus', tenantId, branchId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listMenusServerFn({
        data: { accessToken, tenantId: tenantId as string, branchId },
      })
    },
  })
}

export function useMenuCategories(menuId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-menu-categories', tenantId, menuId],
    enabled: Boolean(tenantId) && Boolean(menuId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listCategoriesServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          menuId: menuId as string,
        },
      })
    },
  })
}

export function useMenuItems(categoryId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-menu-items', tenantId, categoryId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listMenuItemsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          categoryId: categoryId ?? undefined,
        },
      })
    },
  })
}

export function useMenuItemOrderingDetail(menuItemId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-menu-item-detail', tenantId, menuItemId],
    enabled: Boolean(tenantId) && Boolean(menuItemId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getMenuItemOrderingDetailServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          id: menuItemId as string,
        },
      })
    },
  })
}

export function useKitchenStations(branchId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-kitchen-stations', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listKitchenStationsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
        },
      })
    },
  })
}
