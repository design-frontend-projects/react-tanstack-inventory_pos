'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterTabs } from '#/components/data/filter-bar'
import { AccessGuard } from '#/features/auth/access-guard'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useDaysRange,
  useRestaurantItemsReport,
  useRestaurantSalesReport,
} from '#/features/restaurant/dashboard/use-dashboard'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import { formatMoney } from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'

interface SalesRow {
  date: string
  orders: number
  guests: number
  sales: string
  discounts: string
  tips: string
  taxes: string
  serviceCharges: string
}

interface ItemRow {
  name: string
  quantity: string
  sales: string
  orders: number
}

const salesColumns: Array<DataTableColumn<SalesRow>> = [
  {
    id: 'date',
    header: 'Date',
    cell: (row) => row.date,
    sortValue: (row) => row.date,
  },
  {
    id: 'orders',
    header: 'Orders',
    align: 'end',
    cell: (row) => row.orders,
    sortValue: (row) => row.orders,
  },
  {
    id: 'guests',
    header: 'Guests',
    align: 'end',
    cell: (row) => row.guests,
    sortValue: (row) => row.guests,
  },
  {
    id: 'sales',
    header: 'Sales',
    align: 'end',
    cell: (row) => formatMoney(row.sales),
    sortValue: (row) => Number(row.sales),
  },
  {
    id: 'discounts',
    header: 'Discounts',
    align: 'end',
    cell: (row) => formatMoney(row.discounts),
    sortValue: (row) => Number(row.discounts),
  },
  {
    id: 'taxes',
    header: 'Taxes',
    align: 'end',
    cell: (row) => formatMoney(row.taxes),
    sortValue: (row) => Number(row.taxes),
  },
  {
    id: 'service',
    header: 'Service',
    align: 'end',
    cell: (row) => formatMoney(row.serviceCharges),
    sortValue: (row) => Number(row.serviceCharges),
  },
  {
    id: 'tips',
    header: 'Tips',
    align: 'end',
    cell: (row) => formatMoney(row.tips),
    sortValue: (row) => Number(row.tips),
  },
]

const itemColumns: Array<DataTableColumn<ItemRow>> = [
  {
    id: 'name',
    header: 'Item',
    cell: (row) => row.name,
    sortValue: (row) => row.name,
  },
  {
    id: 'quantity',
    header: 'Qty sold',
    align: 'end',
    cell: (row) => Number(row.quantity).toLocaleString(),
    sortValue: (row) => Number(row.quantity),
  },
  {
    id: 'orders',
    header: 'Orders',
    align: 'end',
    cell: (row) => row.orders,
    sortValue: (row) => row.orders,
  },
  {
    id: 'sales',
    header: 'Revenue',
    align: 'end',
    cell: (row) => formatMoney(row.sales),
    sortValue: (row) => Number(row.sales),
  },
]

const RANGE_TABS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

export function RestaurantReportsWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []

  const { branches, branchId, setBranchId } = useBranchSelection()
  const [rangeDays, setRangeDays] = React.useState('30')
  const range = useDaysRange(Number(rangeDays))
  const input = branchId ? { branchId, ...range } : null

  const salesQuery = useRestaurantSalesReport(input)
  const itemsQuery = useRestaurantItemsReport(input)

  const totalSales = (salesQuery.data ?? []).reduce(
    (sum, row) => sum + Number(row.sales),
    0,
  )
  const totalOrders = (salesQuery.data ?? []).reduce(
    (sum, row) => sum + row.orders,
    0,
  )

  return (
    <AccessGuard
      permissions={['res.reports.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need reports access to view restaurant reports."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Reports"
        title="Operational reports."
        description="Daily sales, item performance, and totals over the selected period."
        actions={
          <FilterBar>
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            <FilterTabs
              tabs={RANGE_TABS}
              value={rangeDays}
              onChange={setRangeDays}
            />
          </FilterBar>
        }
        metrics={[
          {
            label: 'Period sales',
            value: salesQuery.data ? formatMoney(String(totalSales)) : '—',
            hint: `Last ${rangeDays} days`,
            tone: 'red',
          },
          {
            label: 'Orders',
            value: salesQuery.data ? totalOrders.toLocaleString() : '—',
            hint: 'Completed in period',
            tone: 'neutral',
          },
          {
            label: 'Avg / day',
            value: salesQuery.data
              ? formatMoney(String(totalSales / Math.max(1, Number(rangeDays))))
              : '—',
            hint: 'Revenue per day',
            tone: 'accent',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Sales"
          title="Daily sales"
          description="One row per trading day with totals per component."
        >
          <DataTable
            columns={salesColumns}
            rows={salesQuery.data ?? []}
            rowKey={(row) => row.date}
            isLoading={salesQuery.isLoading}
            isError={salesQuery.isError}
            pageSize={14}
            emptyTitle="No sales in this period"
            emptyDescription="Completed orders will appear here by day."
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Menu"
          title="Item performance"
          description="Quantity and revenue per menu item over the period."
        >
          <DataTable
            columns={itemColumns}
            rows={itemsQuery.data ?? []}
            rowKey={(row) => row.name}
            isLoading={itemsQuery.isLoading}
            isError={itemsQuery.isError}
            pageSize={15}
            emptyTitle="No item sales"
            emptyDescription="Item performance appears once orders complete."
          />
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}
