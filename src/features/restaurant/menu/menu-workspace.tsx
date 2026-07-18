'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { AccessGuard } from '#/features/auth/access-guard'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useKitchenStations,
  useMenuCategories,
  useMenuItems,
  useMenus,
} from '#/features/restaurant/menu/use-menu'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import { formatMoney, titleCase } from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

const ITEM_STATUS_CHIP: Record<string, string> = {
  ACTIVE:
    'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  INACTIVE: 'border-border bg-muted/60 text-muted-foreground',
  OUT_OF_STOCK:
    'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  ARCHIVED: 'border-border bg-muted/60 text-muted-foreground',
}

export function MenuWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []

  const { branches, branchId, setBranchId } = useBranchSelection()
  const menusQuery = useMenus(branchId)
  const [menuId, setMenuId] = React.useState<string | null>(null)
  const menus = menusQuery.data ?? []
  const activeMenu = menus.find((menu) => menu.id === menuId) ?? menus.at(0) ?? null
  const categoriesQuery = useMenuCategories(activeMenu?.id ?? null)
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const itemsQuery = useMenuItems(categoryId)
  const stationsQuery = useKitchenStations(branchId)
  useRestaurantRealtime()

  const stationName = new Map(
    (stationsQuery.data ?? []).map((station) => [station.id, station.name]),
  )
  const items = itemsQuery.data ?? []
  const featured = items.filter((item) => item.isFeatured).length
  const active = items.filter((item) => item.status === 'ACTIVE').length

  return (
    <AccessGuard
      permissions={['res.menu.view', 'res.menu.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need menu-view access to browse the menu."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Menu"
        title="The live menu the order screens sell from."
        description="Browse menus, categories, and items with their prices, stations, and availability status."
        actions={
          <BranchPicker
            branches={branches}
            branchId={branchId}
            onChange={setBranchId}
          />
        }
        metrics={[
          {
            label: 'Items',
            value: itemsQuery.data ? String(items.length) : '—',
            hint: 'In the current view',
            tone: 'red',
          },
          {
            label: 'Active',
            value: itemsQuery.data ? String(active) : '—',
            hint: 'Sellable right now',
            tone: 'neutral',
          },
          {
            label: 'Featured',
            value: itemsQuery.data ? String(featured) : '—',
            hint: 'Highlighted to guests',
            tone: 'accent',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Catalog"
          title={activeMenu ? activeMenu.name : 'Menu items'}
          description="Read-only view — items are managed through the menu services."
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {menus.length > 1 ? (
              <select
                value={activeMenu?.id ?? ''}
                onChange={(event) => {
                  setMenuId(event.target.value)
                  setCategoryId(null)
                }}
                className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
              >
                {menus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={cn(
                  'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                  categoryId === null
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                All categories
              </button>
              {(categoriesQuery.data ?? []).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                    categoryId === category.id
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {itemsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading menu…</p>
          ) : items.length === 0 ? (
            <WorkspaceEmptyState
              title="No menu items"
              description="Menu items appear here once they are created for this workspace."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="pin-card flex flex-col overflow-hidden"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="aspect-[4/3] w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-2xl font-bold text-muted-foreground">
                      {item.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold">
                        {item.name}
                      </p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase',
                          ITEM_STATUS_CHIP[item.status] ?? ITEM_STATUS_CHIP.INACTIVE,
                        )}
                      >
                        {titleCase(item.status)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-primary">
                      {formatMoney(item.basePrice)}
                    </p>
                    <p className="mt-auto text-xs text-muted-foreground">
                      {item.code}
                      {item.kitchenStationId
                        ? ` · ${stationName.get(item.kitchenStationId) ?? 'station'}`
                        : ''}
                      {item.prepTimeMinutes ? ` · ${item.prepTimeMinutes}m prep` : ''}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}
