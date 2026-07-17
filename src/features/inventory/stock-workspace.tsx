'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { useMovements, useStock } from '#/features/inventory/use-stock'
import { useValuationSummary } from '#/features/inventory/use-inventory-analytics'
import { movementTypeSchema } from '#/features/inventory/validation'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import type { MovementFilterInput } from '#/features/inventory/use-stock'

const PAGE_SIZE = 50
const MOVEMENT_TYPES = movementTypeSchema.options

type StockTab = 'balances' | 'movements'

const filterSelectClassName =
  'h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

const headerRowClassName =
  'border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground'

function QtyCell({
  value,
  signed = false,
}: {
  value: string
  signed?: boolean
}) {
  const numeric = Number(value)
  const className = !signed
    ? 'py-2 pr-4 text-right tabular-nums'
    : numeric < 0
      ? 'py-2 pr-4 text-right tabular-nums text-destructive'
      : 'py-2 pr-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400'

  return (
    <td className={className}>
      {signed && numeric > 0 ? '+' : ''}
      {Number.isFinite(numeric) ? numeric.toLocaleString() : value}
    </td>
  )
}

function Pager({
  page,
  hasMore,
  onPage,
}: {
  page: number
  hasMore: boolean
  onPage: (page: number) => void
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>Page {page + 1}</span>
      <div className="flex gap-2">
        <Button
          size="xs"
          variant="outline"
          disabled={page === 0}
          onClick={() => onPage(Math.max(0, page - 1))}
        >
          Previous
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={!hasMore}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export function StockWorkspace() {
  const [tab, setTab] = React.useState<StockTab>('balances')
  const [warehouseId, setWarehouseId] = React.useState('')
  const [movementType, setMovementType] = React.useState('')
  const [onlyNonZero, setOnlyNonZero] = React.useState(true)
  const [page, setPage] = React.useState(0)

  const warehousesQuery = useWarehouses()
  const valuationQuery = useValuationSummary(warehouseId || undefined)

  const stockQuery = useStock({
    warehouseId: warehouseId || undefined,
    onlyNonZero,
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  })
  const movementsQuery = useMovements({
    warehouseId: warehouseId || undefined,
    movementType: (movementType ||
      undefined) as MovementFilterInput['movementType'],
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  })

  const balances = stockQuery.data ?? []
  const movements = movementsQuery.data ?? []
  const totals = valuationQuery.data?.totals

  const switchTab = (next: StockTab) => {
    setTab(next)
    setPage(0)
  }

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Stock ledger"
      title="Live balances and the immutable movement history behind them."
      description="Every quantity on this screen is derived from the append-only movement ledger — balances are projections, never hand-edited numbers."
      metrics={[
        {
          label: 'On hand',
          value: totals ? Number(totals.onHand).toLocaleString() : '—',
          hint: warehouseId ? 'Selected warehouse' : 'All warehouses',
          tone: 'red',
        },
        {
          label: 'Stock value',
          value: totals ? Number(totals.totalValue).toLocaleString() : '—',
          hint: 'Weighted-average valuation',
          tone: 'accent',
        },
        {
          label: 'Avg unit cost',
          value: totals ? Number(totals.avgUnitCost).toLocaleString() : '—',
          hint: 'Blended across grains',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Ledger"
        title={tab === 'balances' ? 'Stock balances' : 'Movement history'}
        description={
          tab === 'balances'
            ? 'Current on-hand, holds, and value per product × warehouse × location grain.'
            : 'Append-only ledger rows — receipts, issues, transfers, adjustments, and counts.'
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => switchTab('balances')}
              className={
                tab === 'balances'
                  ? 'rounded-md bg-card px-3 py-1.5 text-sm font-medium shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
              }
            >
              Balances
            </button>
            <button
              type="button"
              onClick={() => switchTab('movements')}
              className={
                tab === 'movements'
                  ? 'rounded-md bg-card px-3 py-1.5 text-sm font-medium shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
              }
            >
              Movements
            </button>
          </div>

          <select
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value)
              setPage(0)
            }}
            className={filterSelectClassName}
          >
            <option value="">All warehouses</option>
            {(warehousesQuery.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>

          {tab === 'balances' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyNonZero}
                onChange={(event) => {
                  setOnlyNonZero(event.target.checked)
                  setPage(0)
                }}
                className="size-4 accent-primary"
              />
              Non-zero only
            </label>
          ) : (
            <select
              value={movementType}
              onChange={(event) => {
                setMovementType(event.target.value)
                setPage(0)
              }}
              className={filterSelectClassName}
            >
              <option value="">All movement types</option>
              {MOVEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </div>

        {tab === 'balances' ? (
          stockQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading balances…</p>
          ) : stockQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load stock balances"
              description="Check your connection and permissions, then retry."
            />
          ) : balances.length === 0 ? (
            <WorkspaceEmptyState
              title="No stock balances"
              description="Post an opening balance, purchase receipt, or adjustment to see stock here."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-220 border-collapse text-sm">
                  <thead>
                    <tr className={headerRowClassName}>
                      <th className="py-2 pr-4 font-medium">SKU</th>
                      <th className="py-2 pr-4 font-medium">Product</th>
                      <th className="py-2 pr-4 font-medium">Warehouse</th>
                      <th className="py-2 pr-4 font-medium">Location</th>
                      <th className="py-2 pr-4 text-right font-medium">
                        On hand
                      </th>
                      <th className="py-2 pr-4 text-right font-medium">
                        Reserved
                      </th>
                      <th className="py-2 pr-4 text-right font-medium">
                        Available
                      </th>
                      <th className="py-2 pr-4 text-right font-medium">
                        Avg cost
                      </th>
                      <th className="py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((balance) => (
                      <tr
                        key={balance.id}
                        className="border-b border-border/60"
                      >
                        <td className="py-2 pr-4 font-mono text-xs">
                          {balance.product?.sku ?? '—'}
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          {balance.product?.name ?? balance.productId}
                        </td>
                        <td className="py-2 pr-4">
                          {balance.warehouse?.name ?? '—'}
                        </td>
                        <td className="py-2 pr-4">
                          {balance.location?.code ?? '—'}
                        </td>
                        <QtyCell value={balance.onHand} />
                        <QtyCell value={balance.reserved} />
                        <QtyCell value={balance.available} />
                        <QtyCell value={balance.avgUnitCost} />
                        <QtyCell value={balance.totalValue} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                page={page}
                hasMore={balances.length === PAGE_SIZE}
                onPage={setPage}
              />
            </>
          )
        ) : movementsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading movements…</p>
        ) : movementsQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load movements"
            description="Check your connection and permissions, then retry."
          />
        ) : movements.length === 0 ? (
          <WorkspaceEmptyState
            title="No movements recorded"
            description="The ledger fills up as documents post receipts, sales, transfers, and adjustments."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-240 border-collapse text-sm">
                <thead>
                  <tr className={headerRowClassName}>
                    <th className="py-2 pr-4 font-medium">Occurred</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Product</th>
                    <th className="py-2 pr-4 font-medium">Warehouse</th>
                    <th className="py-2 pr-4 text-right font-medium">Qty Δ</th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Unit cost
                    </th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Running
                    </th>
                    <th className="py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(movement.occurredAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium lowercase">
                          {movement.movementType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="font-mono text-xs">
                          {movement.product?.sku ?? '—'}
                        </span>
                        <span className="ml-2">
                          {movement.product?.name ?? ''}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {movement.warehouse?.name ?? '—'}
                      </td>
                      <QtyCell value={movement.qtyDelta} signed />
                      <QtyCell value={movement.unitCost} />
                      <QtyCell value={movement.runningOnHand} />
                      <td className="py-2 text-xs text-muted-foreground">
                        {movement.sourceDocNumber ??
                          movement.sourceDocType
                            .replace(/_/g, ' ')
                            .toLowerCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              hasMore={movements.length === PAGE_SIZE}
              onPage={setPage}
            />
          </>
        )}
      </WorkspacePanel>
    </WorkspacePage>
  )
}
