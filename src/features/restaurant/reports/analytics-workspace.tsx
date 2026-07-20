'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { SimpleLineChart } from '#/components/charts/simple-line-chart'
import { FilterBar, FilterTabs } from '#/components/data/filter-bar'
import { AccessGuard } from '#/features/auth/access-guard'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useDaysRange,
  useRestaurantAnalytics,
} from '#/features/restaurant/dashboard/use-dashboard'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import { formatMoney } from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { cn } from '#/lib/utils'

const RANGE_TABS = [
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Sales heat map: day-of-week rows × hour columns, tinted by revenue share.
function SalesHeatmap({
  cells,
}: {
  cells: Array<{ dayOfWeek: number; hour: number; sales: string }>
}) {
  const max = Math.max(...cells.map((cell) => Number(cell.sales)), 1)
  const byDay = new Map<number, Array<{ hour: number; sales: number }>>()
  for (const cell of cells) {
    const bucket = byDay.get(cell.dayOfWeek) ?? []
    bucket.push({ hour: cell.hour, sales: Number(cell.sales) })
    byDay.set(cell.dayOfWeek, bucket)
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[40rem]">
        <div className="ms-12 grid grid-cols-24 gap-0.5 pb-1">
          {Array.from({ length: 24 }, (_, hour) => (
            <span
              key={hour}
              className="text-center text-[0.6rem] tabular-nums text-muted-foreground"
            >
              {hour % 3 === 0 ? hour : ''}
            </span>
          ))}
        </div>
        {DAY_LABELS.map((label, dayOfWeek) => (
          <div key={label} className="flex items-center gap-1 py-0.5">
            <span className="w-11 shrink-0 text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <div className="grid flex-1 grid-cols-24 gap-0.5">
              {(byDay.get(dayOfWeek) ?? [])
                .sort((a, b) => a.hour - b.hour)
                .map((cell) => {
                  const intensity = cell.sales / max
                  return (
                    <span
                      key={cell.hour}
                      title={`${label} ${cell.hour}:00 — ${formatMoney(String(cell.sales))}`}
                      className={cn(
                        'aspect-square rounded-[3px]',
                        intensity === 0 && 'bg-muted/60',
                      )}
                      style={
                        intensity > 0
                          ? {
                              backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(
                                12 + intensity * 88,
                              )}%, var(--muted))`,
                            }
                          : undefined
                      }
                    />
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RestaurantAnalyticsWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []

  const { branches, branchId, setBranchId } = useBranchSelection()
  const [rangeDays, setRangeDays] = React.useState('30')
  const range = useDaysRange(Number(rangeDays))
  const analyticsQuery = useRestaurantAnalytics(
    branchId ? { branchId, ...range } : null,
  )

  const snapshot = analyticsQuery.data
  const trendData = (snapshot?.trend ?? []).map((point) => ({
    date: point.date.slice(5),
    sales: Number(point.sales),
    orders: point.orders,
  }))
  const kitchenData = (snapshot?.kitchen ?? []).map((point) => ({
    date: point.date.slice(5),
    minutes: Number(point.avgPrepMinutes),
  }))

  const periodSales = trendData.reduce((sum, point) => sum + point.sales, 0)
  const bestDay = trendData.reduce(
    (best, point) => (point.sales > best.sales ? point : best),
    { date: '—', sales: 0, orders: 0 },
  )

  return (
    <AccessGuard
      permissions={['res.analytics.view', 'res.reports.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need analytics access to view restaurant trends."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Analytics"
        title="Trends and patterns."
        description="Revenue trend, busy-hours heat map, and kitchen speed over the selected period."
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
            label: 'Period revenue',
            value: snapshot ? formatMoney(String(periodSales)) : '—',
            hint: `Last ${rangeDays} days`,
            tone: 'red',
          },
          {
            label: 'Best day',
            value: snapshot ? bestDay.date : '—',
            hint: snapshot ? formatMoney(String(bestDay.sales)) : 'Peak revenue',
            tone: 'accent',
          },
          {
            label: 'Staff ranked',
            value: snapshot ? String(snapshot.staff.length) : '—',
            hint: 'By period revenue',
            tone: 'neutral',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Trend"
          title="Daily revenue"
          description="Completed-order revenue per day."
        >
          {analyticsQuery.isLoading ? (
            <WorkspaceEmptyState title="Loading" description="Crunching the period…" />
          ) : trendData.some((point) => point.sales > 0) ? (
            <SimpleLineChart
              data={trendData}
              xKey="date"
              series={[{ key: 'sales', label: 'Sales' }]}
            />
          ) : (
            <WorkspaceEmptyState
              title="No revenue in period"
              description="The trend fills in as orders complete."
            />
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Patterns"
          title="Sales heat map"
          description="Revenue by day of week and hour — find your rushes."
        >
          {snapshot && snapshot.heatmap.some((cell) => Number(cell.sales) > 0) ? (
            <SalesHeatmap cells={snapshot.heatmap} />
          ) : (
            <WorkspaceEmptyState
              title="Not enough data"
              description="The heat map appears once completed orders span the period."
            />
          )}
        </WorkspacePanel>

        <div className="grid gap-6 xl:grid-cols-2">
          <WorkspacePanel
            eyebrow="Kitchen"
            title="Prep speed"
            description="Average minutes from confirm to served, per day."
          >
            {kitchenData.length > 0 ? (
              <SimpleLineChart
                data={kitchenData}
                xKey="date"
                series={[{ key: 'minutes', label: 'Avg minutes' }]}
              />
            ) : (
              <WorkspaceEmptyState
                title="No kitchen timings yet"
                description="Prep speed needs confirmed and served timestamps."
              />
            )}
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="Team"
            title="Staff performance"
            description="Orders opened and revenue per staff member."
          >
            {snapshot && snapshot.staff.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {snapshot.staff.map((row, index) => (
                  <li
                    key={row.profileId ?? `unassigned-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="font-medium">
                        {row.profileId
                          ? `Staff ${row.profileId.slice(0, 8)}`
                          : 'Unassigned'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.orders} orders
                      </span>
                    </span>
                    <strong className="tabular-nums">
                      {formatMoney(row.sales)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <WorkspaceEmptyState
                title="No staff data"
                description="Rankings appear once orders complete in the period."
              />
            )}
          </WorkspacePanel>
        </div>
      </WorkspacePage>
    </AccessGuard>
  )
}
