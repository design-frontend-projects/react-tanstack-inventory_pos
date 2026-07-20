'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { KanbanBoard } from '#/components/board/kanban-board'
import type { KanbanColumn } from '#/components/board/kanban-board'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterTabs } from '#/components/data/filter-bar'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useDeliveries,
  useDeliveryMutations,
  useDeliveryZones,
  useDrivers,
} from '#/features/restaurant/delivery/use-delivery'
import { useOrders } from '#/features/restaurant/orders/use-orders'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  errorMessage,
  formatElapsed,
  formatMoney,
  titleCase,
  useNowTick,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'

type DeliveryTab = 'board' | 'drivers' | 'zones'

const BOARD_COLUMNS: Array<KanbanColumn> = [
  { id: 'PENDING', title: 'Pending', tone: 'neutral' },
  { id: 'ASSIGNED', title: 'Assigned', tone: 'info' },
  { id: 'PICKED_UP', title: 'Picked up', tone: 'warning' },
  { id: 'EN_ROUTE', title: 'En route', tone: 'primary' },
  { id: 'DELIVERED', title: 'Delivered', tone: 'success' },
]

const DRIVER_TONE: Record<string, StatusTone> = {
  AVAILABLE: 'success',
  ON_DELIVERY: 'primary',
  OFFLINE: 'neutral',
}

interface DeliveryRow {
  id: string
  orderId: string
  driverId: string | null
  zoneId: string | null
  status: string
  addressLine: string
  addressNotes: string | null
  failReason: string | null
  createdAt: string | Date
}

export function DeliveryWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.delivery.manage')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const deliveriesQuery = useDeliveries(branchId)
  const driversQuery = useDrivers(branchId)
  const zonesQuery = useDeliveryZones(branchId)
  const ordersQuery = useOrders(branchId ? { branchId } : {})
  const mutations = useDeliveryMutations()
  useRestaurantRealtime()
  const now = useNowTick(30_000)

  const [tab, setTab] = React.useState<DeliveryTab>('board')
  const [error, setError] = React.useState<string | null>(null)
  const [assignFor, setAssignFor] = React.useState<DeliveryRow | null>(null)
  const [drawer, setDrawer] = React.useState<'driver' | 'zone' | 'delivery' | null>(
    null,
  )
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const deliveries = (deliveriesQuery.data ?? []) as Array<DeliveryRow>
  const drivers = driversQuery.data ?? []
  const zones = zonesQuery.data ?? []

  const orderById = new Map(
    (ordersQuery.data ?? []).map((order) => [order.id, order]),
  )
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]))
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]))

  const openCount = deliveries.filter(
    (row) => !['DELIVERED', 'FAILED'].includes(row.status),
  ).length
  const availableDrivers = drivers.filter(
    (driver) => driver.status === 'AVAILABLE',
  ).length

  // Delivery orders that have no dispatch record yet.
  const unlinkedOrders = (ordersQuery.data ?? []).filter(
    (order) =>
      order.orderType === 'DELIVERY' &&
      !['CANCELLED', 'REFUNDED', 'VOIDED', 'COMPLETED'].includes(order.status) &&
      !deliveries.some((row) => row.orderId === order.id),
  )

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  async function advance(
    row: DeliveryRow,
    toStatus: 'PICKED_UP' | 'EN_ROUTE' | 'DELIVERED' | 'FAILED',
    reason?: string,
  ) {
    setError(null)
    try {
      await mutations.transitionDelivery.mutateAsync({
        deliveryId: row.id,
        toStatus,
        reason: reason ?? null,
      })
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  async function submitDrawer() {
    setError(null)
    try {
      if (drawer === 'driver') {
        await mutations.createDriver.mutateAsync({
          branchId: branchId ?? null,
          name: field('name'),
          phone: field('phone'),
          vehicle: field('vehicle') || null,
        })
      } else if (drawer === 'zone') {
        await mutations.createZone.mutateAsync({
          branchId: branchId as string,
          name: field('name'),
          feeAmount: field('feeAmount') || '0',
          etaMinutes: Number(field('etaMinutes') || '45'),
        })
      } else if (drawer === 'delivery') {
        await mutations.createDelivery.mutateAsync({
          branchId: branchId as string,
          orderId: field('orderId'),
          zoneId: field('zoneId') || null,
          addressLine: field('addressLine'),
          addressNotes: field('addressNotes') || null,
        })
      }
      setDrawer(null)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  const driverColumns: Array<DataTableColumn<(typeof drivers)[number]>> = [
    { id: 'name', header: 'Driver', cell: (row) => row.name, sortValue: (row) => row.name },
    { id: 'phone', header: 'Phone', cell: (row) => row.phone },
    { id: 'vehicle', header: 'Vehicle', cell: (row) => row.vehicle ?? '—' },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={DRIVER_TONE[row.status] ?? 'neutral'} dot>
          {titleCase(row.status)}
        </StatusChip>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      cell: (row) =>
        canManage ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              void mutations.setDriverStatus.mutateAsync({
                id: row.id,
                status: row.status === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE',
              })
            }
          >
            {row.status === 'OFFLINE' ? 'Set available' : 'Set offline'}
          </Button>
        ) : null,
    },
  ]

  const zoneColumns: Array<DataTableColumn<(typeof zones)[number]>> = [
    { id: 'name', header: 'Zone', cell: (row) => row.name, sortValue: (row) => row.name },
    {
      id: 'fee',
      header: 'Fee',
      align: 'end',
      cell: (row) => formatMoney(row.feeAmount),
      sortValue: (row) => Number(row.feeAmount),
    },
    {
      id: 'eta',
      header: 'ETA (min)',
      align: 'end',
      cell: (row) => row.etaMinutes,
      sortValue: (row) => row.etaMinutes,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'} dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
      ),
    },
  ]

  return (
    <AccessGuard
      permissions={['res.delivery.view', 'res.delivery.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need delivery access to run dispatch."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Dispatch"
        title="Delivery."
        description="Assign drivers, track each run through hand-over, and manage zones and fees."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            <FilterTabs
              tabs={[
                { value: 'board', label: 'Board', count: openCount },
                { value: 'drivers', label: 'Drivers', count: drivers.length },
                { value: 'zones', label: 'Zones', count: zones.length },
              ]}
              value={tab}
              onChange={(value) => setTab(value as DeliveryTab)}
            />
            {canManage ? (
              <Button
                type="button"
                onClick={() => {
                  setFields({})
                  setError(null)
                  setDrawer(
                    tab === 'drivers'
                      ? 'driver'
                      : tab === 'zones'
                        ? 'zone'
                        : 'delivery',
                  )
                }}
              >
                {tab === 'drivers'
                  ? 'New driver'
                  : tab === 'zones'
                    ? 'New zone'
                    : 'New delivery'}
              </Button>
            ) : null}
          </div>
        }
        metrics={[
          {
            label: 'Open runs',
            value: deliveriesQuery.data ? String(openCount) : '—',
            hint: 'Pending through en-route',
            tone: 'red',
          },
          {
            label: 'Drivers free',
            value: driversQuery.data ? String(availableDrivers) : '—',
            hint: `${drivers.length} on the roster`,
            tone: 'accent',
          },
          {
            label: 'Unlinked orders',
            value: ordersQuery.data ? String(unlinkedOrders.length) : '—',
            hint: 'Delivery orders w/o dispatch',
            tone: 'neutral',
          },
        ]}
      >
        {error && !drawer && !assignFor ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {tab === 'board' ? (
          <WorkspacePanel
            eyebrow="Runs"
            title="Dispatch board"
            description="Tap a card to act; assignment frees automatically at hand-over."
          >
            {deliveries.length === 0 && !deliveriesQuery.isLoading ? (
              <WorkspaceEmptyState
                title="No deliveries"
                description="Create a delivery from an open delivery order to start dispatching."
              />
            ) : (
              <KanbanBoard
                columns={BOARD_COLUMNS}
                cards={deliveries
                  .filter((row) => row.status !== 'FAILED')
                  .map((row) => ({ ...row, columnId: row.status }))}
                renderCard={(card) => {
                  const order = orderById.get(card.orderId)
                  const driver = card.driverId
                    ? driverById.get(card.driverId)
                    : null
                  const zone = card.zoneId ? zoneById.get(card.zoneId) : null
                  return (
                    <article className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          {order?.orderNumber ?? 'Order'}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatElapsed(String(card.createdAt), now)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {card.addressLine}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {driver ? (
                          <StatusChip tone="info" dot>
                            {driver.name}
                          </StatusChip>
                        ) : null}
                        {zone ? (
                          <StatusChip tone="neutral">{zone.name}</StatusChip>
                        ) : null}
                        {order ? (
                          <StatusChip tone="primary">
                            {formatMoney(order.grandTotal, order.currencyCode)}
                          </StatusChip>
                        ) : null}
                      </div>
                      {canManage ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {card.status === 'PENDING' ? (
                            <Button
                              size="xs"
                              onClick={() => {
                                setAssignFor(card)
                                setError(null)
                              }}
                            >
                              Assign driver
                            </Button>
                          ) : null}
                          {card.status === 'ASSIGNED' ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => advance(card, 'PICKED_UP')}
                            >
                              Picked up
                            </Button>
                          ) : null}
                          {card.status === 'PICKED_UP' ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => advance(card, 'EN_ROUTE')}
                            >
                              En route
                            </Button>
                          ) : null}
                          {['PICKED_UP', 'EN_ROUTE'].includes(card.status) ? (
                            <Button
                              size="xs"
                              onClick={() => advance(card, 'DELIVERED')}
                            >
                              Delivered
                            </Button>
                          ) : null}
                          {!['DELIVERED', 'FAILED', 'PENDING'].includes(
                            card.status,
                          ) ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() =>
                                advance(card, 'FAILED', 'Marked failed from board')
                              }
                            >
                              Fail
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  )
                }}
              />
            )}
          </WorkspacePanel>
        ) : null}

        {tab === 'drivers' ? (
          <WorkspacePanel
            eyebrow="Roster"
            title="Drivers"
            description="Status flips to on-delivery automatically when assigned."
          >
            <DataTable
              columns={driverColumns}
              rows={drivers}
              rowKey={(row) => row.id}
              isLoading={driversQuery.isLoading}
              isError={driversQuery.isError}
              emptyTitle="No drivers"
              emptyDescription="Add drivers to start assigning runs."
            />
          </WorkspacePanel>
        ) : null}

        {tab === 'zones' ? (
          <WorkspacePanel
            eyebrow="Coverage"
            title="Delivery zones"
            description="Fees and ETAs default from the zone at dispatch."
          >
            <DataTable
              columns={zoneColumns}
              rows={zones}
              rowKey={(row) => row.id}
              isLoading={zonesQuery.isLoading}
              isError={zonesQuery.isError}
              emptyTitle="No zones"
              emptyDescription="Define zones to standardize fees and ETAs."
            />
          </WorkspacePanel>
        ) : null}
      </WorkspacePage>

      {/* Assign driver drawer */}
      <DrawerForm
        open={Boolean(assignFor)}
        onOpenChange={(open) => {
          if (!open) setAssignFor(null)
        }}
        title="Assign driver"
        description="Only available drivers are shown."
        onSubmit={async () => {
          if (assignFor && field('driverId')) {
            setError(null)
            try {
              await mutations.assignDriver.mutateAsync({
                deliveryId: assignFor.id,
                driverId: field('driverId'),
              })
              setAssignFor(null)
            } catch (submitError: unknown) {
              setError(errorMessage(submitError))
            }
          }
        }}
        isPending={mutations.assignDriver.isPending}
        error={error}
        submitLabel="Assign"
        submitDisabled={!field('driverId')}
      >
        <Field label="Driver" required>
          <select
            className={fieldInputClassName}
            value={field('driverId')}
            onChange={(event) => setField('driverId', event.target.value)}
          >
            <option value="">Choose a driver…</option>
            {drivers
              .filter((driver) => driver.status === 'AVAILABLE')
              .map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} — {driver.phone}
                </option>
              ))}
          </select>
        </Field>
      </DrawerForm>

      {/* Create drawers */}
      <DrawerForm
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null)
        }}
        title={
          drawer === 'driver'
            ? 'New driver'
            : drawer === 'zone'
              ? 'New zone'
              : 'New delivery'
        }
        onSubmit={submitDrawer}
        isPending={
          mutations.createDriver.isPending ||
          mutations.createZone.isPending ||
          mutations.createDelivery.isPending
        }
        error={error}
        submitLabel="Create"
      >
        {drawer === 'driver' ? (
          <>
            <Field label="Name" required>
              <input
                className={fieldInputClassName}
                value={field('name')}
                onChange={(event) => setField('name', event.target.value)}
                required
              />
            </Field>
            <Field label="Phone" required>
              <input
                className={fieldInputClassName}
                value={field('phone')}
                onChange={(event) => setField('phone', event.target.value)}
                required
              />
            </Field>
            <Field label="Vehicle">
              <input
                className={fieldInputClassName}
                value={field('vehicle')}
                onChange={(event) => setField('vehicle', event.target.value)}
              />
            </Field>
          </>
        ) : null}

        {drawer === 'zone' ? (
          <>
            <Field label="Zone name" required>
              <input
                className={fieldInputClassName}
                value={field('name')}
                onChange={(event) => setField('name', event.target.value)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Delivery fee">
                <input
                  className={fieldInputClassName}
                  type="number"
                  min={0}
                  step="0.01"
                  value={field('feeAmount')}
                  onChange={(event) => setField('feeAmount', event.target.value)}
                />
              </Field>
              <Field label="ETA minutes">
                <input
                  className={fieldInputClassName}
                  type="number"
                  min={5}
                  step={5}
                  value={field('etaMinutes')}
                  onChange={(event) =>
                    setField('etaMinutes', event.target.value)
                  }
                />
              </Field>
            </div>
          </>
        ) : null}

        {drawer === 'delivery' ? (
          <>
            <Field label="Delivery order" required>
              <select
                className={fieldInputClassName}
                value={field('orderId')}
                onChange={(event) => setField('orderId', event.target.value)}
              >
                <option value="">Choose an order…</option>
                {unlinkedOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} —{' '}
                    {formatMoney(order.grandTotal, order.currencyCode)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zone">
              <select
                className={fieldInputClassName}
                value={field('zoneId')}
                onChange={(event) => setField('zoneId', event.target.value)}
              >
                <option value="">No zone</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Address" required>
              <input
                className={fieldInputClassName}
                value={field('addressLine')}
                onChange={(event) =>
                  setField('addressLine', event.target.value)
                }
                required
              />
            </Field>
            <Field label="Address notes">
              <input
                className={fieldInputClassName}
                value={field('addressNotes')}
                onChange={(event) =>
                  setField('addressNotes', event.target.value)
                }
              />
            </Field>
          </>
        ) : null}
      </DrawerForm>
    </AccessGuard>
  )
}
