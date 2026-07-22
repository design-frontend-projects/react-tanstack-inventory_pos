'use client'

import * as React from 'react'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
} from '#/components/data/filter-bar'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useProductsPage } from '#/features/products/use-products'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import {
  useReservationMutations,
  useReservations,
} from '#/features/inventory/use-reservations'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['inventory.view_stock']
const MANAGE = ['inventory.reserve']

const EXPIRING_SOON_MS = 48 * 60 * 60 * 1000

type ReservationRow = NonNullable<
  ReturnType<typeof useReservations>['data']
>[number]

const statusTone: Record<string, StatusTone> = {
  ACTIVE: 'info',
  PARTIALLY_FULFILLED: 'warning',
  FULFILLED: 'success',
  RELEASED: 'neutral',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
}

function formatEnumLabel(value: string | null | undefined) {
  if (!value) {
    return '—'
  }
  const words = value.toLowerCase().split('_')
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(' ')
}

function formatQty(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return '—'
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : value
}

function openHoldQty(row: ReservationRow) {
  const remaining =
    Number(row.quantity) - Number(row.fulfilledQty) - Number(row.releasedQty)
  return Number.isFinite(remaining) ? Math.max(remaining, 0) : 0
}

function isOpenStatus(status: string) {
  return status === 'ACTIVE' || status === 'PARTIALLY_FULFILLED'
}

function ExpiryCell({ row }: { row: ReservationRow }) {
  if (!row.expiresAt) {
    return <span className="text-xs text-muted-foreground">No expiry</span>
  }

  const expiresAt = new Date(row.expiresAt)
  const now = Date.now()
  const pastDue = expiresAt.getTime() < now
  const soon = !pastDue && expiresAt.getTime() - now <= EXPIRING_SOON_MS

  return (
    <span
      className={
        pastDue && isOpenStatus(row.status)
          ? 'whitespace-nowrap text-xs font-semibold text-destructive'
          : soon && isOpenStatus(row.status)
            ? 'whitespace-nowrap text-xs font-semibold text-amber-600 dark:text-amber-400'
            : 'whitespace-nowrap text-xs text-muted-foreground'
      }
    >
      {expiresAt.toLocaleString()}
    </span>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

export function ReservationWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const [status, setStatus] = React.useState('')
  const [type, setType] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [expireOpen, setExpireOpen] = React.useState(false)

  const reservationsQuery = useReservations()
  const productsQuery = useProductsPage({ take: 200 })
  const warehousesQuery = useWarehouses()
  const { expireReservations } = useReservationMutations()

  const reservations = reservationsQuery.data ?? []

  const productLabel = React.useCallback(
    (id: string) => {
      const product = (productsQuery.data?.items ?? []).find(
        (item) => item.id === id,
      )
      return product ? `${product.sku} — ${product.name}` : id
    },
    [productsQuery.data],
  )

  const warehouseName = React.useCallback(
    (id: string) =>
      (warehousesQuery.data ?? []).find((warehouse) => warehouse.id === id)
        ?.name ?? id,
    [warehousesQuery.data],
  )

  // Filtering happens client-side on the most recent page of holds.
  const rows = reservations.filter((row) => {
    if (status && row.status !== status) {
      return false
    }
    if (type && row.reservationType !== type) {
      return false
    }
    if (search) {
      const needle = search.toLowerCase()
      const haystack = [
        productLabel(row.productId),
        row.sourceDocNumber ?? '',
        row.notes ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) {
        return false
      }
    }
    return true
  })

  const now = Date.now()
  const openHolds = reservations.filter((row) => isOpenStatus(row.status))
  const totalReservedQty = openHolds.reduce(
    (sum, row) => sum + openHoldQty(row),
    0,
  )
  const expiringSoon = openHolds.filter((row) => {
    if (!row.expiresAt) {
      return false
    }
    const expiresAt = new Date(row.expiresAt).getTime()
    return expiresAt - now <= EXPIRING_SOON_MS
  })
  const fulfilledCount = reservations.filter(
    (row) => row.status === 'FULFILLED',
  ).length
  const releasedCount = reservations.filter(
    (row) => row.status === 'RELEASED' || row.status === 'EXPIRED',
  ).length

  const columns: DataTableColumn<ReservationRow>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (row) => (
        <span className="font-medium">{productLabel(row.productId)}</span>
      ),
      sortValue: (row) => productLabel(row.productId),
      exportValue: (row) => productLabel(row.productId),
      alwaysVisible: true,
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: (row) => warehouseName(row.warehouseId),
      sortValue: (row) => warehouseName(row.warehouseId),
      exportValue: (row) => warehouseName(row.warehouseId),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => formatEnumLabel(row.reservationType),
      sortValue: (row) => row.reservationType,
      exportValue: (row) => row.reservationType,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={statusTone[row.status] ?? 'neutral'} dot>
          {formatEnumLabel(row.status)}
        </StatusChip>
      ),
      sortValue: (row) => row.status,
      exportValue: (row) => row.status,
    },
    {
      id: 'quantity',
      header: 'Quantity',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.quantity)}</span>
      ),
      sortValue: (row) => Number(row.quantity),
      exportValue: (row) => row.quantity,
    },
    {
      id: 'fulfilledQty',
      header: 'Fulfilled',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.fulfilledQty)}</span>
      ),
      sortValue: (row) => Number(row.fulfilledQty),
      exportValue: (row) => row.fulfilledQty,
    },
    {
      id: 'sourceDoc',
      header: 'Source document',
      cell: (row) =>
        row.sourceDocNumber ? (
          <span className="font-mono text-xs">{row.sourceDocNumber}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortValue: (row) => row.sourceDocNumber ?? '',
      exportValue: (row) => row.sourceDocNumber ?? '',
    },
    {
      id: 'expiresAt',
      header: 'Expires',
      cell: (row) => <ExpiryCell row={row} />,
      sortValue: (row) =>
        row.expiresAt
          ? new Date(row.expiresAt).getTime()
          : Number.MAX_SAFE_INTEGER,
      exportValue: (row) =>
        row.expiresAt ? new Date(row.expiresAt).toISOString() : '',
    },
  ]

  async function runExpireSweep() {
    try {
      const result = await expireReservations.mutateAsync()
      setExpireOpen(false)
      notifySuccess(
        'Expiry sweep complete',
        result.expired === 0
          ? 'No stale holds were found.'
          : `${result.expired} hold(s) released back to available stock.`,
      )
    } catch (error) {
      notifyError(error, 'Could not expire stale holds')
    }
  }

  const selected = selectedId
    ? (reservations.find((row) => row.id === selectedId) ?? null)
    : null

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory · Allocation"
      title="Stock Reservations"
      description="Soft holds raise the reserved bucket without moving stock, so available quantity drops the moment a document commits to a future issue. Fulfilment, release, or expiry hands the units back."
      actions={
        can(MANAGE) ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setExpireOpen(true)}
          >
            Expire stale holds
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Active holds',
          value: reservationsQuery.isLoading
            ? '—'
            : openHolds.length.toLocaleString(),
          hint: 'Active or partially fulfilled',
          tone: 'red',
        },
        {
          label: 'Reserved qty',
          value: reservationsQuery.isLoading
            ? '—'
            : totalReservedQty.toLocaleString(),
          hint: `${expiringSoon.length} hold(s) expiring within 48h`,
          tone: 'accent',
        },
        {
          label: 'Settled',
          value: reservationsQuery.isLoading
            ? '—'
            : `${fulfilledCount.toLocaleString()} / ${releasedCount.toLocaleString()}`,
          hint: 'Fulfilled vs released or expired',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Reservation holds"
        description="Open a hold to inspect its source document, remaining quantity, and expiry."
      >
        <AccessGuard
          permissions={VIEW}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to reservations"
              description="Ask an administrator for the 'View Stock' permission."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'PARTIALLY_FULFILLED', label: 'Partially fulfilled' },
                { value: 'FULFILLED', label: 'Fulfilled' },
                { value: 'RELEASED', label: 'Released' },
                { value: 'EXPIRED', label: 'Expired' },
              ]}
            />
            <FilterSelect
              label="Type"
              value={type}
              onChange={setType}
              allLabel="All types"
              options={[
                { value: 'SALES_ORDER', label: 'Sales order' },
                { value: 'TRANSFER', label: 'Transfer' },
                { value: 'PRODUCTION', label: 'Production' },
                { value: 'MANUAL', label: 'Manual' },
              ]}
            />
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search product or source doc…"
            />
          </FilterBar>

          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              isLoading={reservationsQuery.isLoading}
              isError={reservationsQuery.isError}
              errorMessage="Could not load reservations. Check your connection and permissions, then retry."
              emptyTitle="No reservations"
              emptyDescription="Holds are created when documents (sales orders, transfers, production) commit stock for future issue."
              onRowClick={(row) => setSelectedId(row.id)}
              enableColumnVisibility
              exportFileName="stock-reservations"
              pageSize={20}
            />
          </div>
        </AccessGuard>
      </WorkspacePanel>

      <ConfirmDialog
        open={expireOpen}
        onOpenChange={setExpireOpen}
        title="Expire stale holds?"
        description="Every active hold whose expiry has lapsed is released back to available stock. This does not move any inventory — it only frees the reserved bucket."
        confirmLabel="Run expiry sweep"
        isPending={expireReservations.isPending}
        onConfirm={runExpireSweep}
      />

      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {selected ? productLabel(selected.productId) : 'Reservation'}
            </SheetTitle>
            <SheetDescription>
              {selected
                ? `${formatEnumLabel(selected.reservationType)} hold at ${warehouseName(selected.warehouseId)}`
                : 'Loading reservation…'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {selected ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <DetailRow
                  label="Status"
                  value={
                    <StatusChip
                      tone={statusTone[selected.status] ?? 'neutral'}
                      dot
                    >
                      {formatEnumLabel(selected.status)}
                    </StatusChip>
                  }
                />
                <DetailRow
                  label="Type"
                  value={formatEnumLabel(selected.reservationType)}
                />
                <DetailRow
                  label="Quantity"
                  value={formatQty(selected.quantity)}
                />
                <DetailRow
                  label="Open hold"
                  value={openHoldQty(selected).toLocaleString()}
                />
                <DetailRow
                  label="Fulfilled qty"
                  value={formatQty(selected.fulfilledQty)}
                />
                <DetailRow
                  label="Released qty"
                  value={formatQty(selected.releasedQty)}
                />
                <DetailRow
                  label="Warehouse"
                  value={warehouseName(selected.warehouseId)}
                />
                <DetailRow
                  label="Source document"
                  value={
                    selected.sourceDocNumber ? (
                      <span className="font-mono text-xs">
                        {selected.sourceDocNumber}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow
                  label="Source type"
                  value={formatEnumLabel(selected.sourceDocType)}
                />
                <DetailRow
                  label="Expires"
                  value={
                    selected.expiresAt
                      ? new Date(selected.expiresAt).toLocaleString()
                      : 'No expiry'
                  }
                />
                <DetailRow
                  label="Created"
                  value={new Date(selected.createdAt).toLocaleString()}
                />
                <DetailRow
                  label="Updated"
                  value={new Date(selected.updatedAt).toLocaleString()}
                />
                {selected.notes ? (
                  <div className="sm:col-span-2">
                    <DetailRow label="Notes" value={selected.notes} />
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reservation not found.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </WorkspacePage>
  )
}
