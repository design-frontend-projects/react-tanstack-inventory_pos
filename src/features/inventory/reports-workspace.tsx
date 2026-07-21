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
import { KpiGrid, StatCard } from '#/components/data/stat-card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs'
import { Button } from '#/components/ui/button'
import { SimpleBarChart } from '#/components/charts/simple-bar-chart'
import { SimpleLineChart } from '#/components/charts/simple-line-chart'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  useMovementTrend,
  useReorderSuggestions,
  useStockByCategory,
  useTopProductsByValue,
  useValuationSummary,
  useWarehouseSummaries,
} from '#/features/inventory/use-inventory-analytics'
import {
  currentPeriodKey,
  useStockSnapshots,
  useTakeSnapshot,
} from '#/features/inventory/use-inventory-reports'
import { useProductsPage } from '#/features/products/use-products'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const TREND_DAYS = 30
const TOP_PRODUCT_LIMIT = 15
const PRODUCT_LOOKUP_TAKE = 200

type ValuationRow = NonNullable<
  ReturnType<typeof useValuationSummary>['data']
>['byProduct'][number]
type CategoryRow = NonNullable<ReturnType<typeof useStockByCategory>['data']>[number]
type TopProductRow = NonNullable<
  ReturnType<typeof useTopProductsByValue>['data']
>[number]
type TrendRow = NonNullable<ReturnType<typeof useMovementTrend>['data']>[number]
type WarehouseRow = NonNullable<
  ReturnType<typeof useWarehouseSummaries>['data']
>[number]
type ReorderRow = NonNullable<
  ReturnType<typeof useReorderSuggestions>['data']
>[number]
type SnapshotRow = NonNullable<ReturnType<typeof useStockSnapshots>['data']>[number]

function formatNumber(value: string | number | null | undefined): string {
  const numeric = Number(value)

  return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
}

function formatMoney(value: string | number | null | undefined): string {
  const numeric = Number(value)

  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase()
}

export function InventoryReportsWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const [warehouseId, setWarehouseId] = React.useState('')
  const [tab, setTab] = React.useState('valuation')

  const scopedWarehouseId = warehouseId || undefined

  const warehousesQuery = useWarehouses()
  const valuationQuery = useValuationSummary(scopedWarehouseId)
  const categoryQuery = useStockByCategory(scopedWarehouseId)
  const topProductsQuery = useTopProductsByValue(TOP_PRODUCT_LIMIT)
  const trendQuery = useMovementTrend({
    warehouseId: scopedWarehouseId,
    days: TREND_DAYS,
  })
  const warehouseSummariesQuery = useWarehouseSummaries()
  const reorderQuery = useReorderSuggestions(scopedWarehouseId)
  const snapshotsQuery = useStockSnapshots()
  const takeSnapshot = useTakeSnapshot()
  // Lookup pool: valuation, reorder and snapshot rows carry IDs, not names.
  const productsQuery = useProductsPage({ take: PRODUCT_LOOKUP_TAKE })

  const canManageSnapshots = can(['inventory.manage_reorder'])

  const productName = React.useMemo(
    () =>
      new Map(
        (productsQuery.data?.items ?? []).map((product) => [
          product.id,
          `${product.sku} — ${product.name}`,
        ]),
      ),
    [productsQuery.data],
  )
  const warehouseName = React.useMemo(
    () =>
      new Map(
        (warehousesQuery.data ?? []).map((warehouse) => [
          warehouse.id,
          warehouse.name,
        ]),
      ),
    [warehousesQuery.data],
  )

  const totals = valuationQuery.data?.totals
  const valuationRows = valuationQuery.data?.byProduct ?? []
  const categoryRows = categoryQuery.data ?? []
  const topProductRows = topProductsQuery.data ?? []
  const trendRows = trendQuery.data ?? []
  const warehouseRows = warehouseSummariesQuery.data ?? []
  const reorderRows = reorderQuery.data ?? []
  const snapshotRows = snapshotsQuery.data ?? []

  const categoryChart = React.useMemo(
    () =>
      categoryRows.slice(0, 12).map((row) => ({
        name: row.categoryName,
        value: Number(row.totalValue),
      })),
    [categoryRows],
  )
  const topProductChart = React.useMemo(
    () =>
      topProductRows.map((row) => ({
        name: row.sku,
        value: Number(row.totalValue),
      })),
    [topProductRows],
  )
  const trendChart = React.useMemo(
    () =>
      trendRows.map((point) => ({
        day: point.day.slice(5),
        inQty: Number(point.inQty),
        outQty: Number(point.outQty),
      })),
    [trendRows],
  )

  const valuationColumns: DataTableColumn<ValuationRow>[] = React.useMemo(
    () => [
      {
        id: 'product',
        header: 'Product',
        cell: (row) => productName.get(row.productId) ?? row.productId,
        sortValue: (row) => productName.get(row.productId) ?? row.productId,
        exportValue: (row) => productName.get(row.productId) ?? row.productId,
        alwaysVisible: true,
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) => warehouseName.get(row.warehouseId) ?? row.warehouseId,
        sortValue: (row) => warehouseName.get(row.warehouseId) ?? row.warehouseId,
        exportValue: (row) =>
          warehouseName.get(row.warehouseId) ?? row.warehouseId,
      },
      {
        id: 'onHand',
        header: 'On hand',
        align: 'end',
        cell: (row) => formatNumber(row.onHand),
        sortValue: (row) => Number(row.onHand),
        exportValue: (row) => row.onHand,
      },
      {
        id: 'avgUnitCost',
        header: 'Avg unit cost',
        align: 'end',
        cell: (row) => formatMoney(row.avgUnitCost),
        sortValue: (row) => Number(row.avgUnitCost),
        exportValue: (row) => row.avgUnitCost,
      },
      {
        id: 'totalValue',
        header: 'Stock value',
        align: 'end',
        cell: (row) => (
          <span className="font-semibold">{formatMoney(row.totalValue)}</span>
        ),
        sortValue: (row) => Number(row.totalValue),
        exportValue: (row) => row.totalValue,
      },
    ],
    [productName, warehouseName],
  )

  const categoryColumns: DataTableColumn<CategoryRow>[] = React.useMemo(
    () => [
      {
        id: 'category',
        header: 'Category',
        cell: (row) => row.categoryName,
        sortValue: (row) => row.categoryName,
        exportValue: (row) => row.categoryName,
        alwaysVisible: true,
      },
      {
        id: 'onHand',
        header: 'On hand',
        align: 'end',
        cell: (row) => formatNumber(row.onHand),
        sortValue: (row) => Number(row.onHand),
        exportValue: (row) => row.onHand,
      },
      {
        id: 'totalValue',
        header: 'Stock value',
        align: 'end',
        cell: (row) => formatMoney(row.totalValue),
        sortValue: (row) => Number(row.totalValue),
        exportValue: (row) => row.totalValue,
      },
    ],
    [],
  )

  const topProductColumns: DataTableColumn<TopProductRow>[] = React.useMemo(
    () => [
      {
        id: 'sku',
        header: 'SKU',
        cell: (row) => <span className="font-mono text-xs">{row.sku}</span>,
        sortValue: (row) => row.sku,
        exportValue: (row) => row.sku,
        alwaysVisible: true,
      },
      {
        id: 'name',
        header: 'Product',
        cell: (row) => row.name,
        sortValue: (row) => row.name,
        exportValue: (row) => row.name,
      },
      {
        id: 'onHand',
        header: 'On hand',
        align: 'end',
        cell: (row) => formatNumber(row.onHand),
        sortValue: (row) => Number(row.onHand),
        exportValue: (row) => row.onHand,
      },
      {
        id: 'totalValue',
        header: 'Stock value',
        align: 'end',
        cell: (row) => formatMoney(row.totalValue),
        sortValue: (row) => Number(row.totalValue),
        exportValue: (row) => row.totalValue,
      },
    ],
    [],
  )

  const trendColumns: DataTableColumn<TrendRow>[] = React.useMemo(
    () => [
      {
        id: 'day',
        header: 'Day',
        cell: (row) => row.day,
        sortValue: (row) => row.day,
        exportValue: (row) => row.day,
        alwaysVisible: true,
      },
      {
        id: 'inQty',
        header: 'Inbound qty',
        align: 'end',
        cell: (row) => formatNumber(row.inQty),
        sortValue: (row) => Number(row.inQty),
        exportValue: (row) => row.inQty,
      },
      {
        id: 'outQty',
        header: 'Outbound qty',
        align: 'end',
        cell: (row) => formatNumber(row.outQty),
        sortValue: (row) => Number(row.outQty),
        exportValue: (row) => row.outQty,
      },
      {
        id: 'inValue',
        header: 'Inbound value',
        align: 'end',
        cell: (row) => formatMoney(row.inValue),
        sortValue: (row) => Number(row.inValue),
        exportValue: (row) => row.inValue,
        defaultHidden: true,
      },
      {
        id: 'outValue',
        header: 'Outbound value',
        align: 'end',
        cell: (row) => formatMoney(row.outValue),
        sortValue: (row) => Number(row.outValue),
        exportValue: (row) => row.outValue,
        defaultHidden: true,
      },
    ],
    [],
  )

  const warehouseColumns: DataTableColumn<WarehouseRow>[] = React.useMemo(
    () => [
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.code}
            </span>
          </div>
        ),
        sortValue: (row) => row.name,
        exportValue: (row) => `${row.code} — ${row.name}`,
        alwaysVisible: true,
      },
      {
        id: 'warehouseType',
        header: 'Type',
        cell: (row) => humanize(row.warehouseType),
        sortValue: (row) => row.warehouseType,
        exportValue: (row) => row.warehouseType,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (row.isActive ? 'Active' : 'Inactive'),
        sortValue: (row) => (row.isActive ? 'Active' : 'Inactive'),
        exportValue: (row) => (row.isActive ? 'Active' : 'Inactive'),
      },
      {
        id: 'skuCount',
        header: 'SKUs',
        align: 'end',
        cell: (row) => formatNumber(row.skuCount),
        sortValue: (row) => row.skuCount,
        exportValue: (row) => row.skuCount,
      },
      {
        id: 'locationCount',
        header: 'Locations',
        align: 'end',
        cell: (row) => formatNumber(row.locationCount),
        sortValue: (row) => row.locationCount,
        exportValue: (row) => row.locationCount,
      },
      {
        id: 'onHand',
        header: 'On hand',
        align: 'end',
        cell: (row) => formatNumber(row.onHand),
        sortValue: (row) => Number(row.onHand),
        exportValue: (row) => row.onHand,
      },
      {
        id: 'totalValue',
        header: 'Stock value',
        align: 'end',
        cell: (row) => formatMoney(row.totalValue),
        sortValue: (row) => Number(row.totalValue),
        exportValue: (row) => row.totalValue,
      },
    ],
    [],
  )

  const reorderColumns: DataTableColumn<ReorderRow>[] = React.useMemo(
    () => [
      {
        id: 'product',
        header: 'Product',
        cell: (row) => productName.get(row.productId) ?? row.productId,
        sortValue: (row) => productName.get(row.productId) ?? row.productId,
        exportValue: (row) => productName.get(row.productId) ?? row.productId,
        alwaysVisible: true,
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) => warehouseName.get(row.warehouseId) ?? row.warehouseId,
        sortValue: (row) => warehouseName.get(row.warehouseId) ?? row.warehouseId,
        exportValue: (row) =>
          warehouseName.get(row.warehouseId) ?? row.warehouseId,
      },
      {
        id: 'available',
        header: 'On hand',
        align: 'end',
        cell: (row) => formatNumber(row.available),
        sortValue: (row) => Number(row.available),
        exportValue: (row) => row.available,
      },
      {
        id: 'reorderPoint',
        header: 'Reorder point',
        align: 'end',
        cell: (row) => formatNumber(row.reorderPoint),
        sortValue: (row) => Number(row.reorderPoint),
        exportValue: (row) => row.reorderPoint,
      },
      {
        id: 'suggestedQty',
        header: 'Suggested qty',
        align: 'end',
        cell: (row) => (
          <span className="font-semibold text-primary">
            {formatNumber(row.suggestedQty)}
          </span>
        ),
        sortValue: (row) => Number(row.suggestedQty),
        exportValue: (row) => row.suggestedQty,
      },
      {
        id: 'leadTimeDays',
        header: 'Lead time',
        align: 'end',
        cell: (row) => row.leadTimeDays ?? '—',
        sortValue: (row) => row.leadTimeDays ?? 0,
        exportValue: (row) => row.leadTimeDays ?? '',
      },
    ],
    [productName, warehouseName],
  )

  const snapshotColumns: DataTableColumn<SnapshotRow>[] = React.useMemo(
    () => [
      {
        id: 'periodKey',
        header: 'Period',
        cell: (row) => row.periodKey,
        sortValue: (row) => row.periodKey,
        exportValue: (row) => row.periodKey,
        alwaysVisible: true,
      },
      {
        id: 'snapshotDate',
        header: 'Taken',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(row.snapshotDate).toLocaleString()}
          </span>
        ),
        sortValue: (row) => new Date(row.snapshotDate).getTime(),
        exportValue: (row) => new Date(row.snapshotDate).toISOString(),
      },
      {
        id: 'product',
        header: 'Product',
        cell: (row) => productName.get(row.productId) ?? row.productId,
        sortValue: (row) => productName.get(row.productId) ?? row.productId,
        exportValue: (row) => productName.get(row.productId) ?? row.productId,
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) =>
          row.warehouseId
            ? (warehouseName.get(row.warehouseId) ?? row.warehouseId)
            : '—',
        sortValue: (row) =>
          row.warehouseId
            ? (warehouseName.get(row.warehouseId) ?? row.warehouseId)
            : '',
        exportValue: (row) =>
          row.warehouseId
            ? (warehouseName.get(row.warehouseId) ?? row.warehouseId)
            : '',
      },
      {
        id: 'onHand',
        header: 'On hand',
        align: 'end',
        cell: (row) => formatNumber(row.onHand),
        sortValue: (row) => Number(row.onHand),
        exportValue: (row) => row.onHand,
      },
      {
        id: 'reserved',
        header: 'Reserved',
        align: 'end',
        cell: (row) => formatNumber(row.reserved),
        sortValue: (row) => Number(row.reserved),
        exportValue: (row) => row.reserved,
        defaultHidden: true,
      },
      {
        id: 'avgUnitCost',
        header: 'Avg unit cost',
        align: 'end',
        cell: (row) => formatMoney(row.avgUnitCost),
        sortValue: (row) => Number(row.avgUnitCost),
        exportValue: (row) => row.avgUnitCost,
      },
      {
        id: 'totalValue',
        header: 'Stock value',
        align: 'end',
        cell: (row) => formatMoney(row.totalValue),
        sortValue: (row) => Number(row.totalValue),
        exportValue: (row) => row.totalValue,
      },
    ],
    [productName, warehouseName],
  )

  function handleTakeSnapshot() {
    const periodKey = currentPeriodKey()

    takeSnapshot.mutate(periodKey, {
      onSuccess: (result) =>
        notifySuccess(
          `Snapshot ${result.periodKey} captured`,
          `${result.rows.toLocaleString()} balance rows materialized.`,
        ),
      onError: (error) => notifyError(error, 'Could not take the snapshot'),
    })
  }

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory reports"
      title="Valuation, distribution, flow, and replenishment in one reporting surface."
      description="Every report reads from the materialized balances and the movement ledger, scoped to the warehouse you select. Tables export to CSV for audit and month-end review."
      metrics={[
        {
          label: 'Total stock value',
          value: totals ? formatMoney(totals.totalValue) : '—',
          hint: 'Weighted-average valuation',
          tone: 'red',
        },
        {
          label: 'On-hand units',
          value: totals ? formatNumber(totals.onHand) : '—',
          hint: warehouseId
            ? (warehouseName.get(warehouseId) ?? 'Selected warehouse')
            : 'All warehouses',
          tone: 'accent',
        },
        {
          label: 'Avg unit cost',
          value: totals ? formatMoney(totals.avgUnitCost) : '—',
          hint: 'Blended across the selection',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Reporting"
        title="Inventory reports"
        description="Switch between reports, scope them to a warehouse, and export the view you need."
      >
        <AccessGuard
          permissions={['inventory.view_valuation', 'inventory.view_stock']}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to inventory reports"
              description="Ask an administrator for the 'View Stock' or 'View Valuation' permission to open this workspace."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Warehouse"
              value={warehouseId}
              onChange={setWarehouseId}
              allLabel="All warehouses"
              options={(warehousesQuery.data ?? []).map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              }))}
            />
          </FilterBar>

          <Tabs value={tab} onValueChange={setTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
              <TabsTrigger value="categories">Stock by category</TabsTrigger>
              <TabsTrigger value="top-products">Top products</TabsTrigger>
              <TabsTrigger value="movement-trend">Movement trend</TabsTrigger>
              <TabsTrigger value="warehouses">Warehouse performance</TabsTrigger>
              <TabsTrigger value="reorder">Reorder report</TabsTrigger>
              <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
            </TabsList>

            <TabsContent value="valuation" className="flex flex-col gap-5">
              <KpiGrid columns={3}>
                <StatCard
                  label="Total stock value"
                  value={totals ? formatMoney(totals.totalValue) : '—'}
                  hint="Sum of on-hand × weighted-average cost"
                  tone="primary"
                  isLoading={valuationQuery.isLoading}
                />
                <StatCard
                  label="On-hand units"
                  value={totals ? formatNumber(totals.onHand) : '—'}
                  hint="Physical units across the selection"
                  isLoading={valuationQuery.isLoading}
                />
                <StatCard
                  label="Avg unit cost"
                  value={totals ? formatMoney(totals.avgUnitCost) : '—'}
                  hint="Blended weighted-average cost"
                  isLoading={valuationQuery.isLoading}
                />
              </KpiGrid>

              <DataTable
                columns={valuationColumns}
                rows={valuationRows}
                rowKey={(row) => `${row.productId}-${row.warehouseId}`}
                isLoading={valuationQuery.isLoading}
                isError={valuationQuery.isError}
                errorMessage="Could not load the valuation report. Check your permissions, then retry."
                emptyTitle="No stock value yet"
                emptyDescription="Valuation lines appear once receipts or opening balances are posted."
                pageSize={25}
                enableColumnVisibility
                exportFileName="inventory-valuation"
                stickyHeader
              />
            </TabsContent>

            <TabsContent value="categories" className="flex flex-col gap-5">
              {categoryChart.length > 0 ? (
                <SimpleBarChart
                  data={categoryChart}
                  xKey="name"
                  series={[{ key: 'value', label: 'Stock value' }]}
                  height={260}
                />
              ) : null}

              <DataTable
                columns={categoryColumns}
                rows={categoryRows}
                rowKey={(row) => row.categoryId ?? row.categoryName}
                isLoading={categoryQuery.isLoading}
                isError={categoryQuery.isError}
                errorMessage="Could not load the category breakdown. Check your permissions, then retry."
                emptyTitle="No category distribution yet"
                emptyDescription="Assign categories to products and post stock to populate this report."
                pageSize={25}
                exportFileName="inventory-stock-by-category"
              />
            </TabsContent>

            <TabsContent value="top-products" className="flex flex-col gap-5">
              {topProductChart.length > 0 ? (
                <SimpleBarChart
                  data={topProductChart}
                  xKey="name"
                  series={[
                    {
                      key: 'value',
                      label: 'Stock value',
                      color: 'var(--chart-3)',
                    },
                  ]}
                  height={320}
                  horizontal
                />
              ) : null}

              <DataTable
                columns={topProductColumns}
                rows={topProductRows}
                rowKey={(row) => row.productId}
                isLoading={topProductsQuery.isLoading}
                isError={topProductsQuery.isError}
                errorMessage="Could not load the top products report. Check your permissions, then retry."
                emptyTitle="No stock value yet"
                emptyDescription="The highest-value SKUs appear once stock is on hand."
                exportFileName="inventory-top-products"
              />
            </TabsContent>

            <TabsContent value="movement-trend" className="flex flex-col gap-5">
              {trendChart.length > 0 ? (
                <SimpleLineChart
                  data={trendChart}
                  xKey="day"
                  series={[
                    { key: 'inQty', label: 'Inbound qty' },
                    { key: 'outQty', label: 'Outbound qty' },
                  ]}
                  height={280}
                />
              ) : null}

              <DataTable
                columns={trendColumns}
                rows={trendRows}
                rowKey={(row) => row.day}
                isLoading={trendQuery.isLoading}
                isError={trendQuery.isError}
                errorMessage="Could not load the movement trend. Check your permissions, then retry."
                emptyTitle="No movements in range"
                emptyDescription={`No physical movements were posted in the last ${TREND_DAYS} days for this selection.`}
                pageSize={31}
                enableColumnVisibility
                exportFileName="inventory-movement-trend"
              />
            </TabsContent>

            <TabsContent value="warehouses">
              <DataTable
                columns={warehouseColumns}
                rows={warehouseRows}
                rowKey={(row) => row.warehouseId}
                isLoading={warehouseSummariesQuery.isLoading}
                isError={warehouseSummariesQuery.isError}
                errorMessage="Could not load warehouse performance. Check your permissions, then retry."
                emptyTitle="No warehouses yet"
                emptyDescription="Create a warehouse to start tracking stock and value per site."
                enableColumnVisibility
                exportFileName="inventory-warehouse-performance"
              />
            </TabsContent>

            <TabsContent value="reorder">
              <DataTable
                columns={reorderColumns}
                rows={reorderRows}
                rowKey={(row) => `${row.productId}-${row.warehouseId}`}
                isLoading={reorderQuery.isLoading}
                isError={reorderQuery.isError}
                errorMessage="Could not load reorder suggestions. Check your permissions, then retry."
                emptyTitle="No lines below reorder point"
                emptyDescription="All tracked products sit above their thresholds, or no active reorder rules exist yet."
                pageSize={25}
                exportFileName="inventory-reorder-report"
              />
            </TabsContent>

            <TabsContent value="snapshots" className="flex flex-col gap-4">
              {canManageSnapshots ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={takeSnapshot.isPending}
                    onClick={handleTakeSnapshot}
                  >
                    {takeSnapshot.isPending
                      ? 'Taking snapshot…'
                      : `Take snapshot (${currentPeriodKey()})`}
                  </Button>
                </div>
              ) : null}

              <DataTable
                columns={snapshotColumns}
                rows={snapshotRows}
                rowKey={(row) => row.id}
                isLoading={snapshotsQuery.isLoading}
                isError={snapshotsQuery.isError}
                errorMessage="Could not load valuation snapshots. Check your permissions, then retry."
                emptyTitle="No snapshots captured"
                emptyDescription="Take a period snapshot to freeze the current valuation for month-end reporting."
                pageSize={25}
                enableColumnVisibility
                exportFileName="inventory-valuation-snapshots"
                stickyHeader
              />
            </TabsContent>
          </Tabs>
        </AccessGuard>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
