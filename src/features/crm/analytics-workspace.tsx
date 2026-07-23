'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { SimpleBarChart } from '#/components/charts/simple-bar-chart'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterSelect } from '#/components/data/filter-bar'
import { StatusChip } from '#/components/board/status-chip'
import { useCrmDashboard } from '#/features/crm/use-crm-dashboard'
import type { CrmDashboard } from '#/features/crm/use-crm-dashboard'
import {
  churnRisk,
  formatDate,
  formatMoney,
  formatNumber,
  formatRfmSegment,
  rfmTone,
} from '#/features/crm/crm-format'

// Customer analytics: behavioral distributions and exportable metric tables
// over the projection, with an adjustable churn threshold.

type MetricsRow = CrmDashboard['topCustomers'][number]

const CHURN_THRESHOLDS = [
  { value: '0.5', label: 'Churn ≥ 50%' },
  { value: '0.6', label: 'Churn ≥ 60%' },
  { value: '0.7', label: 'Churn ≥ 70%' },
  { value: '0.8', label: 'Churn ≥ 80%' },
  { value: '0.9', label: 'Churn ≥ 90%' },
]

export function CrmAnalyticsWorkspace() {
  const navigate = useNavigate()
  const [threshold, setThreshold] = React.useState('0.7')
  const dashboardQuery = useCrmDashboard(Number(threshold))

  const dashboard = dashboardQuery.data

  const rfmData = (dashboard?.rfmDistribution ?? [])
    .filter((bucket) => bucket.segment)
    .map((bucket) => ({
      name: formatRfmSegment(bucket.segment),
      value: bucket.count,
    }))

  const openCustomer = (row: MetricsRow) => {
    void navigate({
      to: '/crm/customers/$customerId',
      params: { customerId: row.customerId },
    })
  }

  const metricColumns: DataTableColumn<MetricsRow>[] = [
    {
      id: 'customer',
      header: 'Customer',
      alwaysVisible: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.customerName}</span>
          <span className="text-xs text-muted-foreground">
            {row.customerCode ?? '—'}
          </span>
        </div>
      ),
      sortValue: (row) => row.customerName,
      exportValue: (row) => row.customerName,
    },
    {
      id: 'orders',
      header: 'Orders',
      align: 'end',
      cell: (row) => formatNumber(row.ordersCount),
      sortValue: (row) => row.ordersCount,
      exportValue: (row) => row.ordersCount,
    },
    {
      id: 'spend',
      header: 'Total spend',
      align: 'end',
      cell: (row) => formatMoney(row.totalSpend),
      sortValue: (row) => Number(row.totalSpend),
      exportValue: (row) => row.totalSpend,
    },
    {
      id: 'aov',
      header: 'AOV',
      align: 'end',
      cell: (row) => formatMoney(row.avgOrderValue),
      sortValue: (row) => Number(row.avgOrderValue),
      exportValue: (row) => row.avgOrderValue,
    },
    {
      id: 'lastPurchase',
      header: 'Last purchase',
      cell: (row) => formatDate(row.lastPurchaseAt),
      sortValue: (row) =>
        row.lastPurchaseAt ? new Date(row.lastPurchaseAt).getTime() : 0,
      exportValue: (row) =>
        row.lastPurchaseAt ? new Date(row.lastPurchaseAt).toISOString() : '',
    },
    {
      id: 'rfm',
      header: 'RFM',
      cell: (row) =>
        row.rfmSegment ? (
          <StatusChip tone={rfmTone[row.rfmSegment] ?? 'neutral'}>
            {formatRfmSegment(row.rfmSegment)}
          </StatusChip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortValue: (row) => row.rfmSegment ?? '',
      exportValue: (row) => row.rfmSegment ?? '',
    },
    {
      id: 'churn',
      header: 'Churn',
      cell: (row) => {
        const meta = churnRisk(row.churnScore)
        return <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
      },
      sortValue: (row) => Number(row.churnScore ?? 0),
      exportValue: (row) => row.churnScore ?? '',
    },
    {
      id: 'clv',
      header: 'CLV',
      align: 'end',
      cell: (row) => formatMoney(row.clvEstimate),
      sortValue: (row) => Number(row.clvEstimate ?? 0),
      exportValue: (row) => row.clvEstimate ?? '',
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Customer analytics"
      title="Behavior, value, and retention — from projections, not replays."
      description="Every figure is maintained incrementally by the CRM projector: RFM buckets, lifetime value, and the churn heuristic update as events arrive."
      metrics={[
        {
          label: 'Scored customers',
          value: dashboard ? formatNumber(dashboard.customerCount) : '—',
          hint: 'With behavioral metrics',
          tone: 'red',
        },
        {
          label: 'Revenue',
          value: dashboard ? formatMoney(dashboard.totalSpend) : '—',
          hint: 'Lifetime, all customers',
          tone: 'accent',
        },
        {
          label: 'At churn risk',
          value: dashboard ? formatNumber(dashboard.churnRisk.length) : '—',
          hint: `Above the ${Math.round(Number(threshold) * 100)}% threshold`,
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Distribution"
        title="RFM segments"
        description="How the customer base splits across recency / frequency / monetary buckets."
      >
        {dashboardQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load analytics"
            description="Check your permissions, then retry."
          />
        ) : rfmData.length === 0 ? (
          <WorkspaceEmptyState
            title="No scored customers yet"
            description="Scores appear after sales events flow through the projector."
          />
        ) : (
          <SimpleBarChart
            data={rfmData}
            xKey="name"
            series={[{ key: 'value', label: 'Customers' }]}
            height={280}
          />
        )}
      </WorkspacePanel>

      <WorkspacePanel
        eyebrow="Value"
        title="Top customers by lifetime spend"
        description="Full behavioral metrics — export for offline analysis."
      >
        <DataTable
          columns={metricColumns}
          rows={dashboard?.topCustomers ?? []}
          rowKey={(row) => row.customerId}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          onRowClick={openCustomer}
          enableColumnVisibility
          exportFileName="crm-top-customers"
          emptyTitle="No spend recorded yet"
          emptyDescription="Top customers appear once sales events reach the metrics projection."
        />
      </WorkspacePanel>

      <WorkspacePanel
        eyebrow="Retention"
        title="Churn risk"
        description="Customers whose churn heuristic crossed the selected threshold."
      >
        <div className="flex flex-col gap-3">
          <FilterBar>
            <FilterSelect
              label="Churn threshold"
              value={threshold}
              includeAll={false}
              onChange={setThreshold}
              options={CHURN_THRESHOLDS}
            />
          </FilterBar>
          <DataTable
            columns={metricColumns}
            rows={dashboard?.churnRisk ?? []}
            rowKey={(row) => row.customerId}
            isLoading={dashboardQuery.isLoading}
            isError={dashboardQuery.isError}
            onRowClick={openCustomer}
            enableColumnVisibility
            exportFileName="crm-churn-risk"
            emptyTitle="Nobody above the threshold"
            emptyDescription="Lower the threshold or check back after more activity."
          />
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
