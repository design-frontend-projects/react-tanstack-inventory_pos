'use client'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'
import { SimpleBarChart } from '#/components/charts/simple-bar-chart'
import { SimpleLineChart } from '#/components/charts/simple-line-chart'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { StatusChip } from '#/components/board/status-chip'
import { Skeleton } from '#/components/ui/skeleton'
import { AccessGuard } from '#/features/auth/access-guard'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useRestaurantDashboard,
  useTodayRange,
} from '#/features/restaurant/dashboard/use-dashboard'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  StatusPill,
  formatMoney,
  titleCase,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'

interface TopItemRow {
  name: string
  quantity: string
  sales: string
}

const topItemColumns: Array<DataTableColumn<TopItemRow>> = [
  { id: 'name', header: 'Item', cell: (row) => row.name },
  {
    id: 'quantity',
    header: 'Qty',
    align: 'end',
    cell: (row) => Number(row.quantity).toLocaleString(),
    sortValue: (row) => Number(row.quantity),
  },
  {
    id: 'sales',
    header: 'Sales',
    align: 'end',
    cell: (row) => formatMoney(row.sales),
    sortValue: (row) => Number(row.sales),
  },
]

export function RestaurantDashboardWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []

  const { branches, branchId, setBranchId } = useBranchSelection()
  const range = useTodayRange()
  const dashboardQuery = useRestaurantDashboard(
    branchId ? { branchId, ...range } : null,
  )
  useRestaurantRealtime()

  const snapshot = dashboardQuery.data

  const occupancy =
    snapshot && snapshot.tableStatus.total > 0
      ? Math.round(
          (snapshot.tableStatus.occupied / snapshot.tableStatus.total) * 100,
        )
      : 0

  const hourlyData = (snapshot?.hourlySales ?? []).map((point) => ({
    hour: `${String(point.hour).padStart(2, '0')}:00`,
    sales: Number(point.sales),
    orders: point.orders,
  }))

  const serviceMixData = (snapshot?.serviceMix ?? []).map((row) => ({
    type: titleCase(row.orderType),
    orders: row.orders,
    sales: Number(row.sales),
  }))

  return (
    <AccessGuard
      permissions={['res.dashboard.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need dashboard access to view restaurant performance."
        />
      }
    >
      <WorkspacePage
        variant="hero"
        eyebrow="Restaurant"
        title="Today at a glance."
        description="Live sales, floor occupancy, kitchen load, and the day's momentum — refreshed in real time as service runs."
        actions={
          <BranchPicker
            branches={branches}
            branchId={branchId}
            onChange={setBranchId}
          />
        }
        metrics={[
          {
            label: "Today's sales",
            value: snapshot ? formatMoney(snapshot.todaySales) : '—',
            hint: `${snapshot?.todayOrders ?? 0} completed orders`,
            tone: 'red',
          },
          {
            label: 'Average ticket',
            value: snapshot ? formatMoney(snapshot.averageTicket) : '—',
            hint: `${snapshot?.todayGuests ?? 0} guests served`,
            tone: 'accent',
          },
          {
            label: 'Occupancy',
            value: snapshot ? `${occupancy}%` : '—',
            hint: `${snapshot?.tableStatus.occupied ?? 0} of ${snapshot?.tableStatus.total ?? 0} tables`,
            tone: 'neutral',
          },
        ]}
      >
        {/* Live status strip */}
        <WorkspacePanel
          eyebrow="Live"
          title="Service pulse"
          description="Open orders, kitchen backlog, and floor status right now."
        >
          {dashboardQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : dashboardQuery.isError ? (
            <WorkspaceEmptyState
              title="Unable to load"
              description="The live snapshot could not be fetched. Retry shortly."
            />
          ) : snapshot ? (
            <div className="grid gap-3 md:grid-cols-4">
              <PulseTile
                label="Open orders"
                value={String(snapshot.openOrders)}
                hint="In service now"
              />
              <PulseTile
                label="Kitchen queue"
                value={String(snapshot.kitchenQueue)}
                hint="Items firing/preparing"
              />
              <PulseTile
                label="Available tables"
                value={String(snapshot.tableStatus.available)}
                hint={`${snapshot.tableStatus.reserved} reserved`}
              />
              <PulseTile
                label="Tips today"
                value={formatMoney(snapshot.todayTips)}
                hint={`${formatMoney(snapshot.todayDiscounts)} discounts`}
              />
            </div>
          ) : null}
        </WorkspacePanel>

        <div className="grid gap-6 xl:grid-cols-2">
          <WorkspacePanel
            eyebrow="Revenue"
            title="Hourly sales"
            description="Completed-order revenue by hour of day."
          >
            {hourlyData.some((point) => point.sales > 0) ? (
              <SimpleLineChart
                data={hourlyData}
                xKey="hour"
                series={[{ key: 'sales', label: 'Sales' }]}
              />
            ) : (
              <WorkspaceEmptyState
                title="No sales yet today"
                description="The hourly curve fills in as orders complete."
              />
            )}
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="Mix"
            title="Service types"
            description="Orders and revenue by dine-in, takeaway, and delivery."
          >
            {serviceMixData.length > 0 ? (
              <SimpleBarChart
                data={serviceMixData}
                xKey="type"
                series={[
                  { key: 'orders', label: 'Orders' },
                  { key: 'sales', label: 'Sales' },
                ]}
              />
            ) : (
              <WorkspaceEmptyState
                title="No completed orders"
                description="Service mix appears once orders complete."
              />
            )}
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="Menu"
            title="Top selling items"
            description="Today's leaders by revenue."
          >
            <DataTable
              columns={topItemColumns}
              rows={snapshot?.topItems ?? []}
              rowKey={(row) => row.name}
              isLoading={dashboardQuery.isLoading}
              isError={dashboardQuery.isError}
              emptyTitle="Nothing sold yet"
              emptyDescription="Top items appear as sales come in."
            />
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="Payments"
            title="Payment mix"
            description="Captured payments by method today."
          >
            {snapshot && snapshot.paymentMix.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {snapshot.paymentMix.map((row) => (
                  <li
                    key={row.method}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <StatusChip tone="primary" dot>
                        {titleCase(row.method)}
                      </StatusChip>
                      <span className="text-xs text-muted-foreground">
                        {row.count} payments
                      </span>
                    </span>
                    <strong className="tabular-nums">
                      {formatMoney(row.amount)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <WorkspaceEmptyState
                title="No payments captured"
                description="Payment breakdown appears with the first capture."
              />
            )}
          </WorkspacePanel>
        </div>

        <WorkspacePanel
          eyebrow="Activity"
          title="Recent order events"
          description="The latest status changes across the floor and kitchen."
        >
          {snapshot && snapshot.recentEvents.length > 0 ? (
            <div className="flex flex-col gap-2">
              {snapshot.recentEvents.map((event) => (
                <WorkspaceTimelineItem
                  key={event.id}
                  leading={new Date(event.createdAt).toLocaleTimeString(
                    undefined,
                    { hour: '2-digit', minute: '2-digit' },
                  )}
                  title={`Order ${event.orderNumber}`}
                  description={event.reason ?? titleCase(event.toStatus)}
                />
              ))}
            </div>
          ) : (
            <WorkspaceEmptyState
              title="No activity yet"
              description="Order events stream in here as service runs."
            />
          )}
          {snapshot && snapshot.recentEvents.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {snapshot.recentEvents.slice(0, 4).map((event) => (
                <StatusPill key={`pill-${event.id}`} status={event.toStatus} />
              ))}
            </div>
          ) : null}
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}

function PulseTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <article className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="ops-panel-label">{label}</p>
      <strong className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </strong>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </article>
  )
}
