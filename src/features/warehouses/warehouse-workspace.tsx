'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  LocationFormDialog
  
} from '#/features/warehouses/location-form-dialog'
import type {LocationFormValues} from '#/features/warehouses/location-form-dialog';
import { useWarehouseSummaries } from '#/features/inventory/use-inventory-analytics'
import {
  WarehouseFormDialog
  
} from '#/features/warehouses/warehouse-form-dialog'
import type {WarehouseFormValues} from '#/features/warehouses/warehouse-form-dialog';
import { WarehouseAnalyticsPanel } from '#/features/warehouses/warehouse-analytics-panel'
import {
  useLocations,
  useWarehouses,
} from '#/features/warehouses/use-warehouses'

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

export function WarehouseWorkspace() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [warehouseDialog, setWarehouseDialog] = React.useState(false)
  const [editingWarehouse, setEditingWarehouse] =
    React.useState<WarehouseFormValues | null>(null)
  const [locationDialog, setLocationDialog] = React.useState(false)
  const [editingLocation, setEditingLocation] =
    React.useState<LocationFormValues | null>(null)

  const warehousesQuery = useWarehouses()
  const summariesQuery = useWarehouseSummaries()
  const warehouses = warehousesQuery.data ?? []
  const selected =
    warehouses.find((warehouse) => warehouse.id === selectedId) ?? null
  const locationsQuery = useLocations(selectedId)
  const locations = locationsQuery.data ?? []

  const summaries = summariesQuery.data ?? []
  const totalValue = summaries.reduce(
    (sum, summary) => sum + Number(summary.totalValue),
    0,
  )
  const totalLocations = summaries.reduce(
    (sum, summary) => sum + summary.locationCount,
    0,
  )

  const openCreateWarehouse = () => {
    setEditingWarehouse(null)
    setWarehouseDialog(true)
  }

  const openCreateLocation = () => {
    setEditingLocation(null)
    setLocationDialog(true)
  }

  // Locations arrive depth-annotated; order parent-first via materialized path.
  const orderedLocations = [...locations].sort((a, b) =>
    (a.path ?? a.code).localeCompare(b.path ?? b.code),
  )

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Warehouses & outlets"
      title="Manage storage sites and their location hierarchies."
      description="Warehouses, stores, and outlets with zones, aisles, racks, and bins — the physical grain every stock balance and movement is keyed to."
      actions={<Button onClick={openCreateWarehouse}>New warehouse</Button>}
      metrics={[
        {
          label: 'Warehouses',
          value: warehousesQuery.data ? String(warehouses.length) : '—',
          hint: 'Active storage sites',
          tone: 'red',
        },
        {
          label: 'Stock value',
          value: summariesQuery.data ? totalValue.toLocaleString() : '—',
          hint: 'Across all warehouses',
          tone: 'accent',
        },
        {
          label: 'Locations',
          value: summariesQuery.data ? String(totalLocations) : '—',
          hint: 'Bins, shelves, and zones',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel
          eyebrow="Warehouse register"
          title="Storage sites"
          description="Select a warehouse to manage its location tree."
        >
          {warehousesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading warehouses…</p>
          ) : warehousesQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load warehouses"
              description="Check your connection and permissions, then retry."
            />
          ) : warehouses.length === 0 ? (
            <WorkspaceEmptyState
              title="No warehouses yet"
              description="Create your first warehouse to start posting stock."
            >
              <Button onClick={openCreateWarehouse}>Create warehouse</Button>
            </WorkspaceEmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-140 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Flags</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((warehouse) => (
                    <tr
                      key={warehouse.id}
                      onClick={() => setSelectedId(warehouse.id)}
                      className={
                        warehouse.id === selectedId
                          ? 'cursor-pointer border-b border-border/60 bg-primary/[0.05]'
                          : 'cursor-pointer border-b border-border/60 hover:bg-muted/40'
                      }
                    >
                      <td className="py-2 pr-4 font-mono text-xs">
                        {warehouse.code}
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {warehouse.name}
                        {!warehouse.isActive ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (inactive)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 lowercase">
                        {warehouse.warehouseType}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-1">
                          <FlagBadge on={warehouse.isDefault} label="default" />
                          <FlagBadge
                            on={warehouse.allowNegativeStock}
                            label="neg. stock"
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditingWarehouse(warehouse)
                            setWarehouseDialog(true)
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Locations"
          title={
            selected ? `Location tree — ${selected.name}` : 'Location tree'
          }
          description="Zones, aisles, racks, shelves, and bins inside the selected warehouse."
        >
          <div className="mb-4">
            <Button size="xs" onClick={openCreateLocation} disabled={!selected}>
              New location
            </Button>
          </div>

          {!selected ? (
            <WorkspaceEmptyState
              title="Select a warehouse"
              description="Pick a warehouse on the left to view and edit its locations."
            />
          ) : locationsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading locations…</p>
          ) : locationsQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load locations"
              description="Check your connection and permissions, then retry."
            />
          ) : orderedLocations.length === 0 ? (
            <WorkspaceEmptyState
              title="No locations yet"
              description="Create zones, racks, or bins to receive stock into."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-140 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Flags</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedLocations.map((location) => (
                    <tr key={location.id} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        <span
                          style={{
                            paddingInlineStart: `${location.depth * 1.25}rem`,
                          }}
                          className="font-medium"
                        >
                          {location.name}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {location.code}
                      </td>
                      <td className="py-2 pr-4 lowercase">
                        {location.locationType}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-1">
                          <FlagBadge on={location.isStockable} label="stock" />
                          <FlagBadge on={location.isPickable} label="pick" />
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setEditingLocation(location)
                            setLocationDialog(true)
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WorkspacePanel>
      </div>

      <WarehouseAnalyticsPanel
        selectedWarehouseId={selectedId}
        selectedWarehouseName={selected?.name ?? null}
      />

      <WarehouseFormDialog
        open={warehouseDialog}
        onOpenChange={setWarehouseDialog}
        warehouse={editingWarehouse}
      />
      <LocationFormDialog
        open={locationDialog}
        onOpenChange={setLocationDialog}
        warehouseId={selectedId}
        location={editingLocation}
      />
    </WorkspacePage>
  )
}
