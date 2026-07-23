'use client'

import { KpiGrid, StatCard } from '#/components/data/stat-card'
import { SimpleLineChart } from '#/components/charts/simple-line-chart'
import { StatusChip } from '#/components/board/status-chip'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { useCustomerMetrics } from '#/features/crm/use-customer-360'
import {
  churnRisk,
  formatDate,
  formatMoney,
  formatNumber,
  formatRfmSegment,
  rfmTone,
} from '#/features/crm/crm-format'

// Analytics tab of the customer 360: behavioral metrics from the projection
// plus the monthly spend trend. Read-only — the projector maintains the rows.

export function CustomerAnalyticsTab({ customerId }: { customerId: string }) {
  const metricsQuery = useCustomerMetrics(customerId)

  const metrics = metricsQuery.data?.metrics
  const monthly = [...(metricsQuery.data?.monthly ?? [])]
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
    .map((row) => ({
      month: row.periodKey,
      spend: Number(row.spend),
      orders: row.ordersCount,
    }))

  if (metricsQuery.isError) {
    return (
      <WorkspaceEmptyState
        title="Unable to load analytics"
        description="Check your permissions, then retry."
        className="border-destructive/30 bg-destructive/[0.04]"
      />
    )
  }

  if (!metricsQuery.isLoading && !metrics) {
    return (
      <WorkspaceEmptyState
        title="No behavioral data yet"
        description="Metrics appear once this customer's sales events flow through the CRM projector."
      />
    )
  }

  const churn = churnRisk(metrics?.churnScore ?? null)

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={4}>
        <StatCard
          label="Total spend"
          value={metrics ? formatMoney(metrics.totalSpend) : '—'}
          hint={
            metrics?.firstPurchaseAt
              ? `Since ${formatDate(metrics.firstPurchaseAt)}`
              : 'Lifetime'
          }
          tone="primary"
          isLoading={metricsQuery.isLoading}
        />
        <StatCard
          label="Orders"
          value={metrics ? formatNumber(metrics.ordersCount) : '—'}
          hint={
            metrics?.lastPurchaseAt
              ? `Last on ${formatDate(metrics.lastPurchaseAt)}`
              : 'No purchases yet'
          }
          isLoading={metricsQuery.isLoading}
        />
        <StatCard
          label="Avg order value"
          value={metrics ? formatMoney(metrics.avgOrderValue) : '—'}
          hint={`${formatNumber(metrics?.returnsCount ?? 0)} returns (${formatMoney(metrics?.returnsValue ?? '0')})`}
          isLoading={metricsQuery.isLoading}
        />
        <StatCard
          label="CLV estimate"
          value={metrics ? formatMoney(metrics.clvEstimate) : '—'}
          hint="Heuristic projection"
          isLoading={metricsQuery.isLoading}
        />
      </KpiGrid>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">RFM segment:</span>
          {metrics?.rfmSegment ? (
            <StatusChip tone={rfmTone[metrics.rfmSegment] ?? 'neutral'}>
              {formatRfmSegment(metrics.rfmSegment)}
            </StatusChip>
          ) : (
            <span className="text-sm text-muted-foreground">Unscored</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Churn risk:</span>
          <StatusChip tone={churn.tone}>{churn.label}</StatusChip>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            R {metrics?.rfmRecency ?? '—'} · F {metrics?.rfmFrequency ?? '—'} ·
            M {metrics?.rfmMonetary ?? '—'}
          </span>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Monthly spend trend</h3>
        {monthly.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Trend appears after the first month of activity.
          </p>
        ) : (
          <div className="mt-3">
            <SimpleLineChart
              data={monthly}
              xKey="month"
              series={[
                { key: 'spend', label: 'Spend' },
                { key: 'orders', label: 'Orders' },
              ]}
              height={260}
            />
          </div>
        )}
      </section>
    </div>
  )
}
