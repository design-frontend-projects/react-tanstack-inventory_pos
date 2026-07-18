'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { useFloorStatus } from '#/features/restaurant/floor/use-floor'
import { NewOrderDialog, ReasonDialog } from '#/features/restaurant/orders/order-dialogs'
import { useOrderMutations, useOrders } from '#/features/restaurant/orders/use-orders'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  formatElapsed,
  formatMoney,
  StatusPill,
  titleCase,
  useNowTick,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

const STATUS_FILTERS: Array<{ key: string; label: string; statuses: Array<string> }> =
  [
    { key: 'active', label: 'Active', statuses: ['DRAFT', 'OPEN', 'CONFIRMED', 'PREPARING', 'COOKING', 'READY', 'SERVED'] },
    { key: 'draft', label: 'Draft', statuses: ['DRAFT', 'OPEN'] },
    { key: 'kitchen', label: 'In kitchen', statuses: ['CONFIRMED', 'PREPARING', 'COOKING'] },
    { key: 'ready', label: 'Ready', statuses: ['READY'] },
    { key: 'served', label: 'Served', statuses: ['SERVED'] },
    { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
    { key: 'closed', label: 'Voided', statuses: ['CANCELLED', 'VOIDED', 'REFUNDED'] },
    { key: 'all', label: 'All', statuses: [] },
  ]

const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'PICKUP', 'DELIVERY', 'DRIVE_THRU']

export function OrdersBoardWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canCreate = hasPermission(permissions, 'res.orders.create')
  const canVoid = hasPermission(permissions, 'res.orders.cancel')

  const navigate = useNavigate()
  const { branches, branchId, setBranchId } = useBranchSelection()
  const ordersQuery = useOrders(branchId ? { branchId } : {})
  const floorQuery = useFloorStatus(branchId)
  const { voidOrder } = useOrderMutations()
  useRestaurantRealtime()
  const now = useNowTick(30_000)

  const [statusFilter, setStatusFilter] = React.useState('active')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [newOrderOpen, setNewOrderOpen] = React.useState(false)
  const [voidTarget, setVoidTarget] = React.useState<{
    id: string
    orderNumber: string
  } | null>(null)

  const tableCodes = new Map<string, string>()
  for (const area of floorQuery.data?.areas ?? []) {
    for (const section of area.sections) {
      for (const table of section.tables) {
        tableCodes.set(table.id, table.code)
      }
    }
  }

  const orders = ordersQuery.data ?? []
  const activeFilter =
    STATUS_FILTERS.find((filter) => filter.key === statusFilter) ??
    STATUS_FILTERS[0]
  const filtered = orders.filter((order) => {
    if (
      activeFilter.statuses.length > 0 &&
      !activeFilter.statuses.includes(order.status)
    ) {
      return false
    }
    if (typeFilter && order.orderType !== typeFilter) {
      return false
    }
    return true
  })

  const activeCount = orders.filter((order) =>
    ['DRAFT', 'OPEN', 'CONFIRMED', 'PREPARING', 'COOKING', 'READY', 'SERVED'].includes(
      order.status,
    ),
  ).length
  const inKitchen = orders.filter((order) =>
    ['CONFIRMED', 'PREPARING', 'COOKING'].includes(order.status),
  ).length
  const openValue = orders
    .filter((order) =>
      ['DRAFT', 'OPEN', 'CONFIRMED', 'PREPARING', 'COOKING', 'READY', 'SERVED'].includes(
        order.status,
      ),
    )
    .reduce((sum, order) => sum + Number(order.grandTotal), 0)

  const goToOrder = (orderId: string) => {
    void navigate({ to: '/restaurant/orders/$orderId', params: { orderId } })
  }

  return (
    <AccessGuard
      permissions={['res.orders.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need order-view access to see the orders board."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Orders"
        title="Every order, from first tap to settled bill."
        description="Track dine-in, takeaway, and delivery orders through the kitchen lifecycle. Tap an order to add items, fire, or take payment."
        actions={
          <>
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            {canCreate ? (
              <Button onClick={() => setNewOrderOpen(true)} disabled={!branchId}>
                <Plus data-icon="inline-start" /> New order
              </Button>
            ) : null}
          </>
        }
        metrics={[
          {
            label: 'Active orders',
            value: ordersQuery.data ? String(activeCount) : '—',
            hint: 'Open through served',
            tone: 'red',
          },
          {
            label: 'In kitchen',
            value: ordersQuery.data ? String(inKitchen) : '—',
            hint: 'Confirmed, preparing, cooking',
            tone: 'accent',
          },
          {
            label: 'Open value',
            value: ordersQuery.data ? formatMoney(openValue) : '—',
            hint: 'Unsettled order totals',
            tone: 'neutral',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Board"
          title="Orders"
          description="Filter by lifecycle stage or order type."
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  className={cn(
                    'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                    statusFilter === filter.key
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
            >
              <option value="">All types</option>
              {ORDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {titleCase(type)}
                </option>
              ))}
            </select>
          </div>

          {!branchId ? (
            <WorkspaceEmptyState
              title="No branch found"
              description="Create a restaurant branch before taking orders."
            />
          ) : ordersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading orders…</p>
          ) : ordersQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load orders"
              description="Check your connection and permissions, then retry."
            />
          ) : filtered.length === 0 ? (
            <WorkspaceEmptyState
              title="No orders match"
              description="Adjust the filters or start a new order."
            >
              {canCreate ? (
                <Button onClick={() => setNewOrderOpen(true)}>New order</Button>
              ) : null}
            </WorkspaceEmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((order) => {
                const tableCode = order.tableId
                  ? tableCodes.get(order.tableId)
                  : null
                return (
                  <article
                    key={order.id}
                    className="pin-card flex flex-col gap-2 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => goToOrder(order.id)}
                        className="text-left text-sm font-bold hover:text-primary"
                      >
                        {order.orderNumber}
                      </button>
                      <StatusPill status={order.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(order.orderType)}
                      {tableCode ? ` · Table ${tableCode}` : ''} ·{' '}
                      {order.guestCount} guest{order.guestCount === 1 ? '' : 's'} ·{' '}
                      {formatElapsed(String(order.createdAt), now)}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold">
                        {formatMoney(order.grandTotal, order.currencyCode)}
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => goToOrder(order.id)}
                        >
                          Open
                        </Button>
                        {canVoid &&
                        !['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOIDED'].includes(
                          order.status,
                        ) ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              setVoidTarget({
                                id: order.id,
                                orderNumber: order.orderNumber,
                              })
                            }
                          >
                            Void
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </WorkspacePanel>

        {branchId ? (
          <NewOrderDialog
            open={newOrderOpen}
            onOpenChange={setNewOrderOpen}
            branchId={branchId}
            onCreated={goToOrder}
          />
        ) : null}

        {voidTarget ? (
          <ReasonDialog
            open={Boolean(voidTarget)}
            onOpenChange={(open) => {
              if (!open) {
                setVoidTarget(null)
              }
            }}
            title={`Void ${voidTarget.orderNumber}?`}
            description="Voided orders are closed permanently and excluded from sales."
            confirmLabel="Void order"
            isPending={voidOrder.isPending}
            onConfirm={async (reason) => {
              await voidOrder.mutateAsync({ id: voidTarget.id, reason })
            }}
          />
        ) : null}
      </WorkspacePage>
    </AccessGuard>
  )
}
