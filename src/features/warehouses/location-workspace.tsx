'use client'

import * as React from 'react'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { FilterBar, FilterSelect } from '#/components/data/filter-bar'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { LocationFormDialog } from '#/features/warehouses/location-form-dialog'
import type { LocationFormValues } from '#/features/warehouses/location-form-dialog'
import {
  useLocationMutations,
  useLocations,
  useWarehouses,
} from '#/features/warehouses/use-warehouses'
import { locationTypeSchema } from '#/features/warehouses/validation'

type LocationRow = NonNullable<ReturnType<typeof useLocations>['data']>[number]

const LOCATION_TYPES = locationTypeSchema.options

// Visual identity per hierarchy level: abbreviation glyph + chip tone.
const TYPE_META: Record<string, { abbr: string; tone: StatusTone }> = {
  ZONE: { abbr: 'Z', tone: 'primary' },
  AISLE: { abbr: 'A', tone: 'info' },
  RACK: { abbr: 'R', tone: 'warning' },
  SHELF: { abbr: 'S', tone: 'success' },
  BIN: { abbr: 'B', tone: 'neutral' },
  DOCK: { abbr: 'D', tone: 'info' },
  STAGING: { abbr: 'ST', tone: 'warning' },
}

function typeMeta(locationType: string) {
  return TYPE_META[locationType] ?? { abbr: '?', tone: 'neutral' as StatusTone }
}

function FlagBadge({ on, label }: { on: boolean; label: string }) {
  if (!on) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium">
      {label}
    </span>
  )
}

interface TreeRow {
  location: LocationRow
  hasChildren: boolean
}

// Group children under their parents and flatten depth-first, honouring the
// collapsed set. Orphans (parent filtered out or missing) render as roots so
// no location silently disappears from the tree.
function flattenTree(
  locations: Array<LocationRow>,
  collapsed: ReadonlySet<string>,
): Array<TreeRow> {
  const ids = new Set(locations.map((location) => location.id))
  const childrenByParent = new Map<string, Array<LocationRow>>()
  const roots: Array<LocationRow> = []

  const sorted = [...locations].sort((a, b) => {
    const bySequence = (a.pickSequence ?? 0) - (b.pickSequence ?? 0)
    return bySequence !== 0 ? bySequence : a.code.localeCompare(b.code)
  })

  for (const location of sorted) {
    if (location.parentId && ids.has(location.parentId)) {
      const siblings = childrenByParent.get(location.parentId) ?? []
      childrenByParent.set(location.parentId, [...siblings, location])
    } else {
      roots.push(location)
    }
  }

  const rows: Array<TreeRow> = []

  const walk = (nodes: Array<LocationRow>) => {
    for (const node of nodes) {
      const children = childrenByParent.get(node.id) ?? []
      rows.push({ location: node, hasChildren: children.length > 0 })
      if (children.length > 0 && !collapsed.has(node.id)) {
        walk(children)
      }
    }
  }

  walk(roots)
  return rows
}

export function LocationWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(['warehouse.manage_locations'])

  const [warehouseId, setWarehouseId] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(
    new Set(),
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingLocation, setEditingLocation] =
    React.useState<LocationFormValues | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<LocationRow | null>(
    null,
  )

  const warehousesQuery = useWarehouses()
  const warehouses = warehousesQuery.data ?? []

  // Default to the tenant's default warehouse, falling back to the first one.
  const fallbackWarehouse =
    warehouses.find((warehouse) => warehouse.isDefault) ?? warehouses.at(0)
  const selectedWarehouseId = warehouseId || fallbackWarehouse?.id || ''
  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ?? null

  const locationsQuery = useLocations(selectedWarehouseId || null)
  const locations = locationsQuery.data ?? []
  const { deleteLocation } = useLocationMutations()

  const stockableCount = locations.filter(
    (location) => location.isStockable,
  ).length
  const pickableCount = locations.filter(
    (location) => location.isPickable,
  ).length
  const zoneCount = locations.filter(
    (location) => location.locationType === 'ZONE',
  ).length

  // With a type filter the hierarchy no longer connects, so show a flat list
  // (depth indentation preserved); without it, render the expandable tree.
  const treeRows = React.useMemo<Array<TreeRow>>(() => {
    if (typeFilter) {
      return locations
        .filter((location) => location.locationType === typeFilter)
        .sort((a, b) => (a.path ?? a.code).localeCompare(b.path ?? b.code))
        .map((location) => ({ location, hasChildren: false }))
    }

    return flattenTree(locations, collapsed)
  }, [locations, typeFilter, collapsed])

  const handleWarehouseChange = (value: string) => {
    setWarehouseId(value)
    setTypeFilter('')
    setCollapsed(new Set())
  }

  const toggleCollapsed = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const openCreate = () => {
    setEditingLocation(null)
    setDialogOpen(true)
  }

  const openEdit = (location: LocationRow) => {
    setEditingLocation(location)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }

    try {
      await deleteLocation.mutateAsync(deleteTarget.id)
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory · Warehousing"
      title="Warehouse Locations"
      description="The storage hierarchy inside each warehouse — zones, aisles, racks, shelves, and bins that every stock balance and pick is keyed to."
      actions={
        canManage ? (
          <Button onClick={openCreate} disabled={!selectedWarehouseId}>
            New location
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Locations',
          value: locationsQuery.data ? String(locations.length) : '—',
          hint: selectedWarehouse
            ? `In ${selectedWarehouse.name}`
            : 'Select a warehouse',
          tone: 'red',
        },
        {
          label: 'Stockable',
          value: locationsQuery.data ? String(stockableCount) : '—',
          hint: 'Can hold stock balances',
          tone: 'accent',
        },
        {
          label: 'Pickable',
          value: locationsQuery.data ? String(pickableCount) : '—',
          hint: 'Eligible for pick routes',
          tone: 'neutral',
        },
        {
          label: 'Zones',
          value: locationsQuery.data ? String(zoneCount) : '—',
          hint: 'Top-level areas',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Location tree"
        title={
          selectedWarehouse
            ? `Storage hierarchy — ${selectedWarehouse.name}`
            : 'Storage hierarchy'
        }
        description="Expand and collapse branches, or filter by level to audit a single tier."
      >
        <AccessGuard
          permissions={['warehouse.view']}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to warehouse locations"
              description="Ask an administrator for the 'View Warehouses' permission to open this screen."
            />
          }
        >
          <FilterBar className="mb-4">
            <FilterSelect
              label="Warehouse"
              value={selectedWarehouseId}
              includeAll={false}
              options={warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: `${warehouse.name} (${warehouse.code})`,
              }))}
              onChange={handleWarehouseChange}
            />
            <FilterSelect
              label="Location type"
              value={typeFilter}
              allLabel="All types"
              options={LOCATION_TYPES.map((option) => ({
                value: option,
                label: option.toLowerCase(),
              }))}
              onChange={setTypeFilter}
            />
          </FilterBar>

          {warehousesQuery.isLoading || locationsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading locations…</p>
          ) : warehousesQuery.isError || locationsQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load locations"
              description="Check your connection and permissions, then retry."
            />
          ) : warehouses.length === 0 ? (
            <WorkspaceEmptyState
              title="No warehouses yet"
              description="Create a warehouse from the Warehouses & outlets screen before adding locations."
            />
          ) : treeRows.length === 0 ? (
            <WorkspaceEmptyState
              title={
                typeFilter ? 'No locations of this type' : 'No locations yet'
              }
              description={
                typeFilter
                  ? 'Clear the type filter or pick another level.'
                  : 'Create zones, racks, or bins to receive stock into.'
              }
            >
              {canManage && !typeFilter ? (
                <Button onClick={openCreate}>Create location</Button>
              ) : null}
            </WorkspaceEmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Location</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Flags</th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Pick seq.
                    </th>
                    {canManage ? (
                      <th className="py-2 text-right font-medium">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {treeRows.map(({ location, hasChildren }) => {
                    const meta = typeMeta(location.locationType)
                    const isCollapsed = collapsed.has(location.id)

                    return (
                      <tr
                        key={location.id}
                        className="border-b border-border/60"
                      >
                        <td className="py-2 pr-4">
                          <div
                            className="flex items-center gap-2"
                            style={{
                              paddingInlineStart: `${location.depth * 1.25}rem`,
                            }}
                          >
                            {hasChildren && !typeFilter ? (
                              <button
                                type="button"
                                aria-label={
                                  isCollapsed
                                    ? `Expand ${location.name}`
                                    : `Collapse ${location.name}`
                                }
                                aria-expanded={!isCollapsed}
                                onClick={() => toggleCollapsed(location.id)}
                                className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <span
                                  aria-hidden
                                  className={
                                    isCollapsed
                                      ? 'text-[10px] leading-none'
                                      : 'rotate-90 text-[10px] leading-none'
                                  }
                                >
                                  ▶
                                </span>
                              </button>
                            ) : (
                              <span aria-hidden className="size-5 shrink-0" />
                            )}
                            <span
                              aria-hidden
                              className="flex size-5 shrink-0 items-center justify-center rounded border border-border bg-muted/60 text-[10px] font-semibold text-muted-foreground"
                            >
                              {meta.abbr}
                            </span>
                            <span className="flex flex-col">
                              <span className="font-medium">
                                {location.name}
                                {!location.isActive ? (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (inactive)
                                  </span>
                                ) : null}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {location.code}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <StatusChip tone={meta.tone}>
                            {location.locationType.toLowerCase()}
                          </StatusChip>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex gap-1">
                            <FlagBadge
                              on={location.isStockable}
                              label="stock"
                            />
                            <FlagBadge on={location.isPickable} label="pick" />
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {location.pickSequence ?? '—'}
                        </td>
                        {canManage ? (
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={openCreate}
                                title="Add a child location (choose the parent in the dialog)"
                              >
                                Add child
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => openEdit(location)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="xs"
                                variant="destructive"
                                onClick={() => setDeleteTarget(location)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AccessGuard>
      </WorkspacePanel>

      <LocationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        warehouseId={selectedWarehouseId || null}
        location={editingLocation}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title="Delete this location?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” (${deleteTarget.code}) will be removed from the location tree. Stock history keyed to it is preserved.`
            : undefined
        }
        confirmLabel="Delete location"
        tone="destructive"
        isPending={deleteLocation.isPending}
        onConfirm={handleDelete}
      />
    </WorkspacePage>
  )
}
