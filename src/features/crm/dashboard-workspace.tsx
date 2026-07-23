'use client'

import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { SimpleBarChart } from '#/components/charts/simple-bar-chart'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { KpiGrid, StatCard } from '#/components/data/stat-card'
import { StatusChip } from '#/components/board/status-chip'
import { useCrmDashboard } from '#/features/crm/use-crm-dashboard'
import { useCrmCustomerSummary } from '#/features/crm/use-crm-customers'
import type { CrmDashboard } from '#/features/crm/use-crm-dashboard'
import {
  churnRisk as churnRiskMeta,
  formatLifecycle,
  formatMoney,
  formatNumber,
  formatRfmSegment,
  rfmTone,
} from '#/features/crm/crm-format'

type DashboardCustomerRow = CrmDashboard['topCustomers'][number]

export function CrmDashboardWorkspace() {
  const navigate = useNavigate()
  const dashboardQuery = useCrmDashboard()
  const summaryQuery = useCrmCustomerSummary()

  const dashboard = dashboardQuery.data
  const summary = summaryQuery.data

  const rfmData = (dashboard?.rfmDistribution ?? [])
    .filter((bucket) => bucket.segment)
    .map((bucket) => ({
      name: formatRfmSegment(bucket.segment),
      value: bucket.count,
    }))

  const lifecycleData = Object.entries(summary?.byLifecycle ?? {}).map(
    ([status, count]) => ({ name: formatLifecycle(status), value: count }),
  )

  const openCustomer = (row: DashboardCustomerRow) => {
    void navigate({
      to: '/crm/customers/$customerId',
      params: { customerId: row.customerId },
    })
  }

  const topCustomerColumns: DataTableColumn<DashboardCustomerRow>[] = [
    {
      id: 'customer',
      header: 'Customer',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.customerName}</span>
          <span className="text-xs text-muted-foreground">
            {row.customerCode ?? '—'}
          </span>
        </div>
      ),
      sortValue: (row) => row.customerName,
      alwaysVisible: true,
    },
    {
      id: 'orders',
      header: 'Orders',
      align: 'end',
      cell: (row) => formatNumber(row.ordersCount),
      sortValue: (row) => row.ordersCount,
    },
    {
      id: 'spend',
      header: 'Total spend',
      align: 'end',
      cell: (row) => formatMoney(row.totalSpend),
      sortValue: (row) => Number(row.totalSpend),
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
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (row) => row.rfmSegment ?? '',
    },
  ]

  const churnColumns: DataTableColumn<DashboardCustomerRow>[] = [
    {
      id: 'customer',
      header: 'Customer',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.customerName}</span>
          <span className="text-xs text-muted-foreground">
            {row.customerCode ?? '—'}
          </span>
        </div>
      ),
      sortValue: (row) => row.customerName,
      alwaysVisible: true,
    },
    {
      id: 'churn',
      header: 'Churn risk',
      cell: (row) => {
        const meta = churnRiskMeta(row.churnScore)
        return <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
      },
      sortValue: (row) => Number(row.churnScore ?? 0),
    },
    {
      id: 'spend',
      header: 'Lifetime spend',
      align: 'end',
      cell: (row) => formatMoney(row.totalSpend),
      sortValue: (row) => Number(row.totalSpend),
    },
    {
      id: 'clv',
      header: 'CLV estimate',
      align: 'end',
      cell: (row) => formatMoney(row.clvEstimate),
      sortValue: (row) => Number(row.clvEstimate ?? 0),
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="CRM overview"
      title="Customer intelligence at a glance."
      description="Revenue, retention, and loyalty signals folded from every module's events — dashboards read projections only, never live transactions."
      actions={
        <>
          <Button asChild size="sm">
            <Link to="/crm/customers">Open customer directory</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/crm/segments">Manage segments</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/crm/loyalty">Loyalty program</Link>
          </Button>
        </>
      }
      metrics={[
        {
          label: 'Customers',
          value: summary ? formatNumber(summary.total) : '—',
          hint: 'All customer records',
          tone: 'red',
        },
        {
          label: 'Total revenue',
          value: dashboard ? formatMoney(dashboard.totalSpend) : '—',
          hint: 'Lifetime spend across customers',
          tone: 'accent',
        },
        {
          label: 'Avg order value',
          value: dashboard ? formatMoney(dashboard.avgOrderValue) : '—',
          hint: 'Across all scored customers',
          tone: 'neutral',
        },
      ]}
    >
      <KpiGrid columns={4}>
        <StatCard
          label="Orders"
          value={dashboard ? formatNumber(dashboard.totalOrders) : '—'}
          hint="Completed sales events"
          isLoading={dashboardQuery.isLoading}
        />
        <StatCard
          label="Returns value"
          value={dashboard ? formatMoney(dashboard.totalReturnsValue) : '—'}
          hint="Credited back to customers"
          tone="warning"
          isLoading={dashboardQuery.isLoading}
        />
        <StatCard
          label="Active customers"
          value={formatNumber(summary?.byLifecycle.ACTIVE ?? 0)}
          hint="Lifecycle: active"
          tone="success"
          isLoading={summaryQuery.isLoading}
        />
        <StatCard
          label="At risk"
          value={formatNumber(summary?.byLifecycle.AT_RISK ?? 0)}
          hint="Lifecycle: at risk"
          tone="danger"
          isLoading={summaryQuery.isLoading}
        />
      </KpiGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel
          eyebrow="Segments"
          title="RFM distribution"
          description="Recency / frequency / monetary buckets across scored customers."
        >
          {dashboardQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load RFM distribution"
              description="Check your permissions, then retry."
            />
          ) : rfmData.length === 0 ? (
            <WorkspaceEmptyState
              title="No scored customers yet"
              description="RFM scores appear after sales events flow through the CRM projector."
            />
          ) : (
            <SimpleBarChart
              data={rfmData}
              xKey="name"
              series={[{ key: 'value', label: 'Customers' }]}
              height={260}
            />
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Lifecycle"
          title="Customers by lifecycle stage"
          description="Profile lifecycle across the customer base."
        >
          {summaryQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load lifecycle distribution"
              description="Check your permissions, then retry."
            />
          ) : lifecycleData.length === 0 ? (
            <WorkspaceEmptyState
              title="No CRM profiles yet"
              description="Lifecycle stages appear once customers have CRM profiles."
            />
          ) : (
            <SimpleBarChart
              data={lifecycleData}
              xKey="name"
              series={[
                { key: 'value', label: 'Customers', color: 'var(--chart-3)' },
              ]}
              height={260}
            />
          )}
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        eyebrow="Revenue"
        title="Top customers by lifetime spend"
        description="The customers holding the most lifetime value — open one for the full 360° view."
      >
        <DataTable
          columns={topCustomerColumns}
          rows={dashboard?.topCustomers ?? []}
          rowKey={(row) => row.customerId}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          onRowClick={openCustomer}
          emptyTitle="No spend recorded yet"
          emptyDescription="Top customers appear once sales events reach the CRM metrics projection."
        />
      </WorkspacePanel>

      <WorkspacePanel
        eyebrow="Retention"
        title="Churn risk watchlist"
        description="Customers whose churn heuristic crossed the risk threshold — reach out before they lapse."
      >
        <DataTable
          columns={churnColumns}
          rows={dashboard?.churnRisk ?? []}
          rowKey={(row) => row.customerId}
          isLoading={dashboardQuery.isLoading}
          isError={dashboardQuery.isError}
          onRowClick={openCustomer}
          emptyTitle="No customers at risk"
          emptyDescription="Nobody has crossed the churn threshold — or scores have not been computed yet."
        />
      </WorkspacePanel>
    </WorkspacePage>
  )
}
