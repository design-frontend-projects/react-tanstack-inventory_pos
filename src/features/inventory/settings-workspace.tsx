'use client'

import * as React from 'react'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { StatusChip } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { fieldInputClassName } from '#/components/forms/drawer-form'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useProductsPage } from '#/features/products/use-products'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import {
  useReorderRuleMutations,
  useReorderRules,
  useValuationSummary,
} from '#/features/inventory/use-inventory-analytics'
import { ReorderRuleDialog } from '#/features/inventory/reorder-rule-dialog'
import type { ReorderRulePrefill } from '#/features/inventory/reorder-rule-dialog'
import {
  useInventorySettingsMutations,
  useSnapshots,
} from '#/features/inventory/use-inventory-settings'
import { useReservationMutations } from '#/features/inventory/use-reservations'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW_STOCK = ['inventory.view_stock']
const MANAGE_REORDER = ['inventory.manage_reorder']
const VIEW_VALUATION = ['inventory.view_valuation']
const MANAGE_LOTS = ['inventory.manage_lots']
const RESERVE = ['inventory.reserve']

type ReorderRuleRow = NonNullable<
  ReturnType<typeof useReorderRules>['data']
>[number]
type SnapshotRow = NonNullable<ReturnType<typeof useSnapshots>['data']>[number]

function currentPeriodKey() {
  return new Date().toISOString().slice(0, 7)
}

function formatQty(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return '—'
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : value
}

function formatMoney(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return '—'
  }
  const numeric = Number(value)
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : value
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </article>
  )
}

// --- Reorder rules section ---------------------------------------------------

function ReorderRulesSection() {
  const { permissions, roles, can } = usePermissions()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [prefill, setPrefill] = React.useState<ReorderRulePrefill>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ReorderRuleRow | null>(
    null,
  )

  const rulesQuery = useReorderRules()
  const productsQuery = useProductsPage({ take: 200 })
  const warehousesQuery = useWarehouses()
  const { deleteReorderRule } = useReorderRuleMutations()

  const canManage = can(MANAGE_REORDER)

  const productLabel = (id: string) => {
    const product = (productsQuery.data?.items ?? []).find(
      (item) => item.id === id,
    )
    return product ? `${product.sku} — ${product.name}` : id
  }

  const warehouseName = (id: string) =>
    (warehousesQuery.data ?? []).find((warehouse) => warehouse.id === id)
      ?.name ?? id

  const columns: DataTableColumn<ReorderRuleRow>[] = [
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
      id: 'minStock',
      header: 'Min',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.minStock)}</span>
      ),
      sortValue: (row) => Number(row.minStock),
      exportValue: (row) => row.minStock,
    },
    {
      id: 'maxStock',
      header: 'Max',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.maxStock)}</span>
      ),
      sortValue: (row) => Number(row.maxStock),
      exportValue: (row) => row.maxStock,
    },
    {
      id: 'safetyStock',
      header: 'Safety',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.safetyStock)}</span>
      ),
      sortValue: (row) => Number(row.safetyStock),
      exportValue: (row) => row.safetyStock,
    },
    {
      id: 'reorderPoint',
      header: 'Reorder point',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.reorderPoint)}</span>
      ),
      sortValue: (row) => Number(row.reorderPoint),
      exportValue: (row) => row.reorderPoint,
    },
    {
      id: 'reorderQty',
      header: 'Reorder qty',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.reorderQty)}</span>
      ),
      sortValue: (row) => Number(row.reorderQty),
      exportValue: (row) => row.reorderQty,
    },
    {
      id: 'leadTimeDays',
      header: 'Lead time',
      cell: (row) =>
        row.leadTimeDays === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">{row.leadTimeDays}d</span>
        ),
      sortValue: (row) => row.leadTimeDays ?? -1,
      exportValue: (row) =>
        row.leadTimeDays === null ? '' : String(row.leadTimeDays),
    },
    {
      id: 'isActive',
      header: 'Active',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'} dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 1 : 0),
      exportValue: (row) => (row.isActive ? 'active' : 'inactive'),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: (row: ReorderRuleRow) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation()
                  setDeleteTarget(row)
                }}
              >
                Delete
              </Button>
            ),
            alwaysVisible: true,
          } satisfies DataTableColumn<ReorderRuleRow>,
        ]
      : []),
  ]

  async function runDelete() {
    if (!deleteTarget) {
      return
    }
    try {
      await deleteReorderRule.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
      notifySuccess(
        'Reorder rule deleted',
        `${productLabel(deleteTarget.productId)} at ${warehouseName(deleteTarget.warehouseId)}`,
      )
    } catch (error) {
      notifyError(error, 'Could not delete the reorder rule')
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Replenishment"
      title="Reorder rules"
      description="Per product × warehouse thresholds that drive reorder suggestions. Saving a rule overwrites the existing one for that pair."
    >
      <AccessGuard
        permissions={VIEW_STOCK}
        userRoles={roles}
        userPermissions={permissions}
        fallback={
          <WorkspaceEmptyState
            title="You don't have access to reorder rules"
            description="Ask an administrator for the 'View Stock' permission."
          />
        }
      >
        {canManage ? (
          <div className="mb-4">
            <Button
              type="button"
              onClick={() => {
                setPrefill(null)
                setDialogOpen(true)
              }}
            >
              New rule
            </Button>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={rulesQuery.data ?? []}
          rowKey={(row) => row.id}
          isLoading={rulesQuery.isLoading}
          isError={rulesQuery.isError}
          errorMessage="Could not load reorder rules. Check your connection and permissions, then retry."
          emptyTitle="No reorder rules yet"
          emptyDescription="Create a rule to set replenishment thresholds for a product at a warehouse."
          onRowClick={
            canManage
              ? (row) => {
                  setPrefill({
                    productId: row.productId,
                    warehouseId: row.warehouseId,
                  })
                  setDialogOpen(true)
                }
              : undefined
          }
          enableColumnVisibility
          exportFileName="reorder-rules"
          pageSize={10}
        />

        <ReorderRuleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          prefill={prefill}
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null)
            }
          }}
          title="Delete this reorder rule?"
          description="The product will no longer appear in reorder suggestions for this warehouse."
          confirmLabel="Delete rule"
          tone="destructive"
          isPending={deleteReorderRule.isPending}
          onConfirm={runDelete}
        />
      </AccessGuard>
    </WorkspacePanel>
  )
}

// --- Valuation snapshots section ---------------------------------------------

function ValuationSection() {
  const { permissions, roles, can } = usePermissions()
  const [periodKey, setPeriodKey] = React.useState(currentPeriodKey)
  const [captureOpen, setCaptureOpen] = React.useState(false)

  const valuationQuery = useValuationSummary()
  const snapshotsQuery = useSnapshots()
  const productsQuery = useProductsPage({ take: 200 })
  const warehousesQuery = useWarehouses()
  const { takeSnapshot } = useInventorySettingsMutations()

  const productLabel = (id: string) => {
    const product = (productsQuery.data?.items ?? []).find(
      (item) => item.id === id,
    )
    return product ? `${product.sku} — ${product.name}` : id
  }

  const warehouseName = (id: string) =>
    (warehousesQuery.data ?? []).find((warehouse) => warehouse.id === id)
      ?.name ?? id

  const totals = valuationQuery.data?.totals

  const columns: DataTableColumn<SnapshotRow>[] = [
    {
      id: 'periodKey',
      header: 'Period',
      cell: (row) => <span className="font-medium">{row.periodKey}</span>,
      sortValue: (row) => row.periodKey,
      exportValue: (row) => row.periodKey,
      alwaysVisible: true,
    },
    {
      id: 'snapshotDate',
      header: 'Captured',
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(row.snapshotDate).toLocaleDateString()}
        </span>
      ),
      sortValue: (row) => new Date(row.snapshotDate).getTime(),
      exportValue: (row) => new Date(row.snapshotDate).toISOString(),
    },
    {
      id: 'product',
      header: 'Product',
      cell: (row) => productLabel(row.productId),
      sortValue: (row) => productLabel(row.productId),
      exportValue: (row) => productLabel(row.productId),
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: (row) => warehouseName(row.warehouseId),
      sortValue: (row) => warehouseName(row.warehouseId),
      exportValue: (row) => warehouseName(row.warehouseId),
    },
    {
      id: 'onHand',
      header: 'On hand',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.onHand)}</span>
      ),
      sortValue: (row) => Number(row.onHand),
      exportValue: (row) => row.onHand,
    },
    {
      id: 'reserved',
      header: 'Reserved',
      cell: (row) => (
        <span className="tabular-nums">{formatQty(row.reserved)}</span>
      ),
      sortValue: (row) => Number(row.reserved),
      exportValue: (row) => row.reserved,
    },
    {
      id: 'avgUnitCost',
      header: 'Avg cost',
      cell: (row) => (
        <span className="tabular-nums">{formatMoney(row.avgUnitCost)}</span>
      ),
      sortValue: (row) => Number(row.avgUnitCost),
      exportValue: (row) => row.avgUnitCost,
    },
    {
      id: 'totalValue',
      header: 'Total value',
      cell: (row) => (
        <span className="tabular-nums">{formatMoney(row.totalValue)}</span>
      ),
      sortValue: (row) => Number(row.totalValue),
      exportValue: (row) => row.totalValue,
    },
  ]

  async function runCapture() {
    try {
      const result = await takeSnapshot.mutateAsync(periodKey)
      setCaptureOpen(false)
      notifySuccess(
        'Snapshot captured',
        `${result.rows} row(s) materialized for ${result.periodKey}.`,
      )
    } catch (error) {
      notifyError(error, 'Could not capture the snapshot')
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Valuation"
      title="Valuation snapshots"
      description="Live valuation aggregates the materialized balances; snapshots freeze a period's valuation for reporting. Re-capturing a period overwrites it."
    >
      <AccessGuard
        permissions={VIEW_VALUATION}
        userRoles={roles}
        userPermissions={permissions}
        fallback={
          <WorkspaceEmptyState
            title="You don't have access to valuation"
            description="Ask an administrator for the 'View Valuation' permission."
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryStat
            label="On hand (units)"
            value={valuationQuery.isLoading ? '—' : formatQty(totals?.onHand)}
          />
          <SummaryStat
            label="Total value"
            value={
              valuationQuery.isLoading ? '—' : formatMoney(totals?.totalValue)
            }
          />
          <SummaryStat
            label="Blended avg cost"
            value={
              valuationQuery.isLoading ? '—' : formatMoney(totals?.avgUnitCost)
            }
          />
        </div>

        {can(MANAGE_REORDER) ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="month"
              aria-label="Snapshot period"
              className={`${fieldInputClassName} w-auto`}
              value={periodKey}
              onChange={(event) => setPeriodKey(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!periodKey}
              onClick={() => setCaptureOpen(true)}
            >
              Capture snapshot
            </Button>
          </div>
        ) : null}

        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={snapshotsQuery.data ?? []}
            rowKey={(row) => row.id}
            isLoading={snapshotsQuery.isLoading}
            isError={snapshotsQuery.isError}
            errorMessage="Could not load snapshots. Check your connection and permissions, then retry."
            emptyTitle="No snapshots yet"
            emptyDescription="Capture a snapshot to freeze the current valuation for a period."
            enableColumnVisibility
            exportFileName="valuation-snapshots"
            pageSize={10}
          />
        </div>

        <ConfirmDialog
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          title={`Capture the ${periodKey} snapshot?`}
          description="Current balances are aggregated per product × variant × warehouse and written as the period's valuation. Any existing snapshot for this period is replaced."
          confirmLabel="Capture snapshot"
          isPending={takeSnapshot.isPending}
          onConfirm={runCapture}
        />
      </AccessGuard>
    </WorkspacePanel>
  )
}

// --- Housekeeping section ----------------------------------------------------

function HousekeepingSection() {
  const { can } = usePermissions()
  const [lotConfirmOpen, setLotConfirmOpen] = React.useState(false)
  const [reservationConfirmOpen, setReservationConfirmOpen] =
    React.useState(false)

  const { expireLots } = useInventorySettingsMutations()
  const { expireReservations } = useReservationMutations()

  const canExpireLots = can(MANAGE_LOTS)
  const canExpireReservations = can(RESERVE)

  async function runExpireLots() {
    try {
      const result = await expireLots.mutateAsync()
      setLotConfirmOpen(false)
      notifySuccess(
        'Lot expiry sweep complete',
        result.expired === 0
          ? 'No lots past their expiry date were found.'
          : `${result.expired} lot(s) marked as expired.`,
      )
    } catch (error) {
      notifyError(error, 'Could not expire lots')
    }
  }

  async function runExpireReservations() {
    try {
      const result = await expireReservations.mutateAsync()
      setReservationConfirmOpen(false)
      notifySuccess(
        'Reservation expiry sweep complete',
        result.expired === 0
          ? 'No stale holds were found.'
          : `${result.expired} hold(s) released back to available stock.`,
      )
    } catch (error) {
      notifyError(error, 'Could not expire stale reservations')
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Maintenance"
      title="Housekeeping"
      description="Manual triggers for the periodic sweeps that normally run as scheduled jobs. Each sweep is idempotent and audited."
    >
      {!canExpireLots && !canExpireReservations ? (
        <WorkspaceEmptyState
          title="No maintenance actions available"
          description="Ask an administrator for the 'Manage Lots' or 'Reserve Stock' permission."
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          {canExpireLots ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setLotConfirmOpen(true)}
            >
              Expire lots past expiry
            </Button>
          ) : null}
          {canExpireReservations ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setReservationConfirmOpen(true)}
            >
              Expire stale reservations
            </Button>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={lotConfirmOpen}
        onOpenChange={setLotConfirmOpen}
        title="Expire lots past their expiry date?"
        description="Active or quarantined lots whose expiry has lapsed are marked EXPIRED. Stock quantities are not changed."
        confirmLabel="Run lot sweep"
        isPending={expireLots.isPending}
        onConfirm={runExpireLots}
      />

      <ConfirmDialog
        open={reservationConfirmOpen}
        onOpenChange={setReservationConfirmOpen}
        title="Expire stale reservations?"
        description="Every active hold whose expiry has lapsed is released back to available stock without moving any inventory."
        confirmLabel="Run reservation sweep"
        isPending={expireReservations.isPending}
        onConfirm={runExpireReservations}
      />
    </WorkspacePanel>
  )
}

// --- Page --------------------------------------------------------------------

export function InventorySettingsWorkspace() {
  const rulesQuery = useReorderRules()
  const snapshotsQuery = useSnapshots()
  const valuationQuery = useValuationSummary()

  const rules = rulesQuery.data ?? []
  const activeRules = rules.filter((rule) => rule.isActive)
  const snapshotPeriods = new Set(
    (snapshotsQuery.data ?? []).map((snapshot) => snapshot.periodKey),
  )

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory · Configuration"
      title="Inventory Settings"
      description="Replenishment thresholds, period valuation snapshots, and the manual triggers for the periodic housekeeping sweeps — all in one place."
      metrics={[
        {
          label: 'Reorder rules',
          value: rulesQuery.isLoading
            ? '—'
            : `${activeRules.length.toLocaleString()} / ${rules.length.toLocaleString()}`,
          hint: 'Active vs total rules',
          tone: 'red',
        },
        {
          label: 'Snapshot periods',
          value: snapshotsQuery.isLoading
            ? '—'
            : snapshotPeriods.size.toLocaleString(),
          hint: 'Periods with a captured valuation',
          tone: 'accent',
        },
        {
          label: 'Stock value',
          value: valuationQuery.isLoading
            ? '—'
            : formatMoney(valuationQuery.data?.totals.totalValue),
          hint: 'Live valuation of on-hand stock',
          tone: 'neutral',
        },
      ]}
    >
      <ReorderRulesSection />
      <ValuationSection />
      <HousekeepingSection />
    </WorkspacePage>
  )
}
