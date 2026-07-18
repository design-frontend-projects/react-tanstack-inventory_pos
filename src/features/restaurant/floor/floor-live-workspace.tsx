'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Armchair, Minus, Plus, Users } from 'lucide-react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { useFloorMutations, useFloorStatus } from '#/features/restaurant/floor/use-floor'
import { useOrderMutations } from '#/features/restaurant/orders/use-orders'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  errorMessage,
  formatElapsed,
  formatMoney,
  StatusPill,
  TABLE_STATUS_STYLES,
  useNowTick,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

export function FloorLiveWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManageFloor = hasPermission(permissions, 'res.floor.manage')
  const canCreateOrder = hasPermission(permissions, 'res.orders.create')

  const navigate = useNavigate()
  const { branches, branchId, setBranchId } = useBranchSelection()
  const floorQuery = useFloorStatus(branchId)
  const floorMutations = useFloorMutations()
  const orderMutations = useOrderMutations()
  useRestaurantRealtime()
  const now = useNowTick(30_000)

  const [areaFilter, setAreaFilter] = React.useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(null)
  const [guestCount, setGuestCount] = React.useState(2)
  const [transferTargetId, setTransferTargetId] = React.useState('')
  const [actionError, setActionError] = React.useState<string | null>(null)

  const payload = floorQuery.data
  const areas = payload?.areas ?? []
  const visibleAreas = areaFilter
    ? areas.filter((area) => area.id === areaFilter)
    : areas

  const allTables = areas.flatMap((area) =>
    area.sections.flatMap((section) =>
      section.tables.map((table) => ({ table, area, section })),
    ),
  )
  const selected = allTables.find((entry) => entry.table.id === selectedTableId)

  const occupied = allTables.filter(
    (entry) => entry.table.effectiveStatus === 'OCCUPIED',
  )
  const covers = occupied.reduce(
    (sum, entry) => sum + (entry.table.activeOrder?.guestCount ?? 0),
    0,
  )
  const openValue = occupied.reduce(
    (sum, entry) => sum + Number(entry.table.activeOrder?.grandTotal ?? 0),
    0,
  )

  const openTable = (tableId: string, seats: number) => {
    setSelectedTableId(tableId)
    setGuestCount(Math.min(2, seats))
    setTransferTargetId('')
    setActionError(null)
  }

  const goToOrder = (orderId: string) => {
    void navigate({ to: '/restaurant/orders/$orderId', params: { orderId } })
  }

  const seatGuests = async () => {
    if (!branchId || !selected) {
      return
    }
    setActionError(null)
    try {
      const order = await orderMutations.createOrder.mutateAsync({
        branchId,
        tableId: selected.table.id,
        orderType: 'DINE_IN',
        guestCount,
      })
      setSelectedTableId(null)
      goToOrder(order.id)
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  const setStatus = async (status: 'AVAILABLE' | 'RESERVED' | 'BLOCKED') => {
    if (!selected) {
      return
    }
    setActionError(null)
    try {
      await floorMutations.setTableStatus.mutateAsync({
        tableId: selected.table.id,
        status,
      })
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  const transferHere = async () => {
    if (!selected?.table.activeOrder || !transferTargetId) {
      return
    }
    setActionError(null)
    try {
      await orderMutations.transferTable.mutateAsync({
        orderId: selected.table.activeOrder.id,
        toTableId: transferTargetId,
      })
      setSelectedTableId(null)
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  const transferTargets = allTables.filter(
    (entry) =>
      entry.table.effectiveStatus === 'AVAILABLE' &&
      entry.table.id !== selected?.table.id,
  )

  return (
    <AccessGuard
      permissions={['res.orders.view', 'res.floor.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need order-view or floor-management access for the live floor."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Live floor"
        title="Every table, its guests, and its order — at a glance."
        description="Tap a table to seat guests, open its order, transfer it, or block it. Updates arrive in real time as waiters and the kitchen work."
        actions={
          <BranchPicker
            branches={branches}
            branchId={branchId}
            onChange={setBranchId}
          />
        }
        metrics={[
          {
            label: 'Occupied',
            value: payload ? `${occupied.length}/${allTables.length}` : '—',
            hint: 'Tables with an active order',
            tone: 'red',
          },
          {
            label: 'Covers seated',
            value: payload ? String(covers) : '—',
            hint: 'Guests currently dining',
            tone: 'accent',
          },
          {
            label: 'Open value',
            value: payload ? formatMoney(openValue) : '—',
            hint: 'Running total of active orders',
            tone: 'neutral',
          },
        ]}
      >
        {!branchId ? (
          <WorkspaceEmptyState
            title="No branch found"
            description="Create a restaurant branch before running floor service."
          />
        ) : floorQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading the floor…</p>
        ) : floorQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load the floor"
            description="Check your connection and permissions, then retry."
          />
        ) : allTables.length === 0 ? (
          <WorkspaceEmptyState
            title="No tables defined"
            description="Define floors, sections, and tables in the floor plan first."
          />
        ) : (
          <WorkspacePanel
            eyebrow="Floor"
            title="Tables"
            description="Color shows live status — green available, red occupied, amber reserved."
          >
            {areas.length > 1 ? (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setAreaFilter(null)}
                  className={cn(
                    'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                    areaFilter === null
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  All floors
                </button>
                {areas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setAreaFilter(area.id)}
                    className={cn(
                      'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                      areaFilter === area.id
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {area.name}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-6">
              {visibleAreas.map((area) => (
                <div key={area.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="ops-kicker">{area.name}</span>
                    {area.floorManager ? (
                      <span className="text-xs text-muted-foreground">
                        Manager: {area.floorManager.displayName}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-4">
                    {area.sections.map((section) => (
                      <div key={section.id}>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {section.name}
                          {section.waiters.length > 0
                            ? ` · ${section.waiters
                                .map((waiter) => waiter.displayName)
                                .join(', ')}`
                            : ''}
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                          {section.tables.map((table) => {
                            const style =
                              TABLE_STATUS_STYLES[table.effectiveStatus] ??
                              TABLE_STATUS_STYLES.AVAILABLE
                            return (
                              <button
                                key={table.id}
                                type="button"
                                onClick={() => openTable(table.id, table.seats)}
                                className={cn(
                                  'pin-card flex min-h-24 flex-col justify-between border p-3 text-left transition-colors',
                                  style.card,
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-base font-bold">
                                    {table.code}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Armchair className="size-3.5" />
                                    {table.seats}
                                  </span>
                                </div>
                                {table.activeOrder ? (
                                  <div className="mt-2 text-xs">
                                    <p className="font-semibold">
                                      {table.activeOrder.orderNumber}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {formatMoney(table.activeOrder.grandTotal)} ·{' '}
                                      {formatElapsed(
                                        table.activeOrder.openedAt,
                                        now,
                                      )}
                                    </p>
                                  </div>
                                ) : (
                                  <span
                                    className={cn(
                                      'mt-2 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold',
                                      style.badge,
                                    )}
                                  >
                                    {style.label}
                                  </span>
                                )}
                                {table.waiters.length > 0 ? (
                                  <p className="mt-1.5 truncate text-[0.68rem] text-muted-foreground">
                                    {table.waiters
                                      .map((waiter) => waiter.displayName)
                                      .join(', ')}
                                  </p>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </WorkspacePanel>
        )}

        <Sheet
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTableId(null)
            }
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-md">
            {selected ? (
              <div className="flex flex-col gap-5 overflow-y-auto p-5">
                <SheetHeader className="p-0">
                  <SheetTitle className="flex items-center gap-3 text-xl">
                    Table {selected.table.code}
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                        (
                          TABLE_STATUS_STYLES[selected.table.effectiveStatus] ??
                          TABLE_STATUS_STYLES.AVAILABLE
                        ).badge,
                      )}
                    >
                      {
                        (
                          TABLE_STATUS_STYLES[selected.table.effectiveStatus] ??
                          TABLE_STATUS_STYLES.AVAILABLE
                        ).label
                      }
                    </span>
                  </SheetTitle>
                  <SheetDescription>
                    {selected.area.name} · {selected.section.name} ·{' '}
                    {selected.table.seats} seats
                    {selected.table.waiters.length > 0
                      ? ` · ${selected.table.waiters
                          .map((waiter) => waiter.displayName)
                          .join(', ')}`
                      : ''}
                  </SheetDescription>
                </SheetHeader>

                {selected.table.activeOrder ? (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        {selected.table.activeOrder.orderNumber}
                      </p>
                      <StatusPill status={selected.table.activeOrder.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selected.table.activeOrder.guestCount} guests ·{' '}
                      {selected.table.activeOrder.itemCount} items ·{' '}
                      {formatMoney(selected.table.activeOrder.grandTotal)} ·{' '}
                      {formatElapsed(selected.table.activeOrder.openedAt, now)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          goToOrder(selected.table.activeOrder?.id ?? '')
                        }
                      >
                        Open order
                      </Button>
                    </div>
                    {canManageFloor && transferTargets.length > 0 ? (
                      <div className="mt-4 border-t border-border pt-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Transfer to another table
                        </p>
                        <div className="flex gap-2">
                          <select
                            value={transferTargetId}
                            onChange={(event) =>
                              setTransferTargetId(event.target.value)
                            }
                            className={selectClassName}
                          >
                            <option value="">Choose a free table…</option>
                            {transferTargets.map((entry) => (
                              <option key={entry.table.id} value={entry.table.id}>
                                {entry.table.code} — {entry.section.name} (
                                {entry.table.seats} seats)
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            disabled={
                              !transferTargetId ||
                              orderMutations.transferTable.isPending
                            }
                            onClick={transferHere}
                          >
                            Transfer
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {selected.table.effectiveStatus !== 'BLOCKED' &&
                    canCreateOrder ? (
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="mb-3 text-sm font-semibold">Seat guests</p>
                        <div className="flex items-center gap-3">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() =>
                              setGuestCount((count) => Math.max(1, count - 1))
                            }
                          >
                            <Minus />
                          </Button>
                          <span className="flex min-w-16 items-center justify-center gap-1.5 text-lg font-bold">
                            <Users className="size-4" /> {guestCount}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() =>
                              setGuestCount((count) => Math.min(100, count + 1))
                            }
                          >
                            <Plus />
                          </Button>
                        </div>
                        <Button
                          className="mt-4 w-full"
                          disabled={orderMutations.createOrder.isPending}
                          onClick={seatGuests}
                        >
                          Seat & open order
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}

                {canManageFloor && !selected.table.activeOrder ? (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-3 text-sm font-semibold">Table status</p>
                    <div className="flex flex-wrap gap-2">
                      {(['AVAILABLE', 'RESERVED', 'BLOCKED'] as const).map(
                        (status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={
                              selected.table.storedStatus === status
                                ? 'default'
                                : 'outline'
                            }
                            disabled={floorMutations.setTableStatus.isPending}
                            onClick={() => setStatus(status)}
                          >
                            {TABLE_STATUS_STYLES[status].label}
                          </Button>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}

                {actionError ? (
                  <p className="text-sm text-destructive">{actionError}</p>
                ) : null}
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </WorkspacePage>
    </AccessGuard>
  )
}
