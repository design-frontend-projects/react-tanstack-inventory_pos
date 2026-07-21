'use client'

import * as React from 'react'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterSelect } from '#/components/data/filter-bar'
import { StatusChip } from '#/components/board/status-chip'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useMovements } from '#/features/inventory/use-stock'
import { movementTypeSchema } from '#/features/inventory/validation'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import type { MovementFilterInput } from '#/features/inventory/use-stock'

const PAGE_SIZE = 50
const MOVEMENT_TYPES = movementTypeSchema.options

// Inbound movements read as gains, outbound as losses — the tone is derived
// from the signed delta rather than the type so reversals colour correctly.
function deltaTone(value: number) {
  if (value > 0) {
    return 'text-emerald-600 dark:text-emerald-400'
  }
  if (value < 0) {
    return 'text-destructive'
  }
  return 'text-muted-foreground'
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').toLowerCase()
}

function formatQty(value: string | number | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
}

type MovementRow = NonNullable<ReturnType<typeof useMovements>['data']>[number]

export function MovementLedgerWorkspace() {
  const { permissions, roles } = usePermissions()
  const [warehouseId, setWarehouseId] = React.useState('')
  const [movementType, setMovementType] = React.useState('')
  const [page, setPage] = React.useState(0)

  const warehousesQuery = useWarehouses()
  const movementsQuery = useMovements({
    warehouseId: warehouseId || undefined,
    movementType: (movementType ||
      undefined) as MovementFilterInput['movementType'],
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  })

  const movements = movementsQuery.data ?? []

  const columns: DataTableColumn<MovementRow>[] = React.useMemo(
    () => [
      {
        id: 'occurredAt',
        header: 'Occurred',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(row.occurredAt).toLocaleString()}
          </span>
        ),
        sortValue: (row) => new Date(row.occurredAt).getTime(),
        exportValue: (row) => new Date(row.occurredAt).toISOString(),
        alwaysVisible: true,
      },
      {
        id: 'movementType',
        header: 'Type',
        cell: (row) => (
          <StatusChip tone="neutral">{humanize(row.movementType)}</StatusChip>
        ),
        sortValue: (row) => row.movementType,
        exportValue: (row) => row.movementType,
      },
      {
        id: 'product',
        header: 'Product',
        cell: (row) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.product?.name ?? '—'}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.product?.sku ?? row.productId}
            </span>
          </div>
        ),
        sortValue: (row) => row.product?.name ?? '',
        exportValue: (row) => row.product?.sku ?? row.productId,
        alwaysVisible: true,
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) => row.warehouse?.name ?? '—',
        sortValue: (row) => row.warehouse?.name ?? '',
        exportValue: (row) => row.warehouse?.name ?? '',
      },
      {
        id: 'qtyDelta',
        header: 'Qty Δ',
        align: 'end',
        cell: (row) => {
          const numeric = Number(row.qtyDelta)
          return (
            <span className={deltaTone(numeric)}>
              {numeric > 0 ? '+' : ''}
              {formatQty(row.qtyDelta)}
            </span>
          )
        },
        sortValue: (row) => Number(row.qtyDelta),
        exportValue: (row) => row.qtyDelta,
      },
      {
        id: 'runningOnHand',
        header: 'Balance after',
        align: 'end',
        cell: (row) => formatQty(row.runningOnHand),
        sortValue: (row) => Number(row.runningOnHand),
        exportValue: (row) => row.runningOnHand,
      },
      {
        id: 'unitCost',
        header: 'Unit cost',
        align: 'end',
        cell: (row) => formatQty(row.unitCost),
        sortValue: (row) => Number(row.unitCost),
        exportValue: (row) => row.unitCost,
        defaultHidden: true,
      },
      {
        id: 'totalCost',
        header: 'Total cost',
        align: 'end',
        cell: (row) => formatQty(row.totalCost),
        sortValue: (row) => Number(row.totalCost),
        exportValue: (row) => row.totalCost,
        defaultHidden: true,
      },
      {
        id: 'source',
        header: 'Reference',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.sourceDocNumber ?? humanize(row.sourceDocType)}
          </span>
        ),
        sortValue: (row) => row.sourceDocNumber ?? row.sourceDocType,
        exportValue: (row) => row.sourceDocNumber ?? row.sourceDocType,
      },
    ],
    [],
  )

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory movements"
      title="The append-only ledger behind every stock number."
      description="Each row is an immutable movement with its signed quantity, cost, resulting balance, and the document that caused it. Nothing here is editable — corrections are posted as new movements."
      metrics={[
        {
          label: 'Rows on page',
          value: movementsQuery.isLoading
            ? '—'
            : movements.length.toLocaleString(),
          hint: `Page ${page + 1}`,
          tone: 'red',
        },
        {
          label: 'Warehouse',
          value: warehouseId
            ? ((warehousesQuery.data ?? []).find((w) => w.id === warehouseId)
                ?.name ?? '—')
            : 'All',
          hint: 'Active filter',
          tone: 'neutral',
        },
        {
          label: 'Movement type',
          value: movementType ? humanize(movementType) : 'All',
          hint: 'Active filter',
          tone: 'accent',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Ledger"
        title="Movement history"
        description="Filter by warehouse and movement type, choose your columns, and export the current view for audit."
      >
        <AccessGuard
          permissions={['inventory.view_movements']}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to inventory movements"
              description="Ask an administrator for the 'View Movements' permission to open the ledger."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Warehouse"
              value={warehouseId}
              onChange={(value) => {
                setWarehouseId(value)
                setPage(0)
              }}
              options={[
                { value: '', label: 'All warehouses' },
                ...(warehousesQuery.data ?? []).map((warehouse) => ({
                  value: warehouse.id,
                  label: warehouse.name,
                })),
              ]}
            />
            <FilterSelect
              label="Movement type"
              value={movementType}
              onChange={(value) => {
                setMovementType(value)
                setPage(0)
              }}
              options={[
                { value: '', label: 'All movement types' },
                ...MOVEMENT_TYPES.map((type) => ({
                  value: type,
                  label: humanize(type),
                })),
              ]}
            />
          </FilterBar>

          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={movements}
              rowKey={(row) => row.id}
              isLoading={movementsQuery.isLoading}
              isError={movementsQuery.isError}
              errorMessage="Could not load movements. Check your connection and permissions, then retry."
              emptyTitle="No movements recorded"
              emptyDescription="The ledger fills up as documents post receipts, sales, transfers, adjustments, and counts."
              enableColumnVisibility
              exportFileName="inventory-movements"
              stickyHeader
            />
          </div>

          {/* The server fn returns a page slice without a total, so the pager
              advances while a full page comes back. */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page + 1}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-50"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-50"
                disabled={movements.length < PAGE_SIZE}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </AccessGuard>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
