'use client'

import * as React from 'react'
import { CheckCheck, ChefHat, Play, Undo2 } from 'lucide-react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { useKitchenStations } from '#/features/restaurant/menu/use-menu'
import { useKitchenBoard, useOrderMutations } from '#/features/restaurant/orders/use-orders'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  elapsedMinutes,
  errorMessage,
  formatElapsed,
  titleCase,
  useNowTick,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

// Cooking-time escalation thresholds (minutes since the order was confirmed).
const WARN_AFTER = 8
const LATE_AFTER = 15

const ITEM_NEXT_STATUS: Record<
  string,
  'FIRED' | 'PREPARING' | 'READY' | 'SERVED' | undefined
> = {
  PENDING: 'FIRED',
  FIRED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
}

const ITEM_STATUS_CHIP: Record<string, string> = {
  PENDING: 'border-border bg-muted/60 text-muted-foreground',
  FIRED: 'border-sky-300/60 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  PREPARING:
    'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  READY:
    'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  SERVED: 'border-border bg-muted/60 text-muted-foreground',
}

export function KitchenBoardWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canProgress = hasPermission(permissions, 'res.kitchen.update_order_status')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const [stationId, setStationId] = React.useState<string | null>(null)
  const stationsQuery = useKitchenStations(branchId)
  const boardQuery = useKitchenBoard(branchId, stationId)
  const mutations = useOrderMutations()
  useRestaurantRealtime()
  const now = useNowTick(5_000)

  const [actionError, setActionError] = React.useState<string | null>(null)

  const tickets = boardQuery.data ?? []
  const lateCount = tickets.filter(
    (ticket) => elapsedMinutes(ticket.confirmedAt, now) >= LATE_AFTER,
  ).length
  const readyCount = tickets.filter((ticket) => ticket.status === 'READY').length

  const advanceItem = async (orderId: string, itemId: string, current: string) => {
    const next = ITEM_NEXT_STATUS[current]
    if (!next || !canProgress) {
      return
    }
    setActionError(null)
    try {
      await mutations.updateItemStatus.mutateAsync({
        orderId,
        itemIds: [itemId],
        toStatus: next,
      })
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  const bulk = async (orderId: string, toStatus: 'PREPARING' | 'READY') => {
    setActionError(null)
    try {
      await mutations.updateItemStatus.mutateAsync({ orderId, toStatus })
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  // Recall pulls a READY ticket back to PREPARING (wrong bump, quality issue).
  const recall = async (orderId: string, itemIds: Array<string>) => {
    setActionError(null)
    try {
      await mutations.updateItemStatus.mutateAsync({
        orderId,
        itemIds,
        toStatus: 'PREPARING',
      })
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  const bump = async (orderId: string) => {
    setActionError(null)
    try {
      await mutations.transition.mutateAsync({ id: orderId, toStatus: 'SERVED' })
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  return (
    <AccessGuard
      permissions={['res.kitchen.access']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need kitchen access to view the board."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Kitchen display"
        title="Fired tickets, routed to your station, in firing order."
        description="Tap an item to advance it, or use Start / All ready / Bump for the whole ticket. Timers escalate as orders age."
        actions={
          <BranchPicker
            branches={branches}
            branchId={branchId}
            onChange={setBranchId}
          />
        }
        metrics={[
          {
            label: 'Live tickets',
            value: boardQuery.data ? String(tickets.length) : '—',
            hint: 'Confirmed through ready',
            tone: 'red',
          },
          {
            label: 'Running late',
            value: boardQuery.data ? String(lateCount) : '—',
            hint: `Over ${LATE_AFTER} minutes`,
            tone: 'accent',
          },
          {
            label: 'Ready to serve',
            value: boardQuery.data ? String(readyCount) : '—',
            hint: 'Waiting for pickup / bump',
            tone: 'neutral',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Queue"
          title="Tickets"
          description="Oldest first. Station filters show only that station's items."
        >
          {(stationsQuery.data ?? []).length > 0 ? (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setStationId(null)}
                className={cn(
                  'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                  stationId === null
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                All stations
              </button>
              {(stationsQuery.data ?? []).map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => setStationId(station.id)}
                  className={cn(
                    'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                    stationId === station.id
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {station.name}
                </button>
              ))}
            </div>
          ) : null}

          {actionError ? (
            <p className="mb-3 text-sm text-destructive">{actionError}</p>
          ) : null}

          {!branchId ? (
            <WorkspaceEmptyState
              title="No branch found"
              description="Create a restaurant branch before running the kitchen."
            />
          ) : boardQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tickets…</p>
          ) : boardQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load the board"
              description="Check your connection and permissions, then retry."
            />
          ) : tickets.length === 0 ? (
            <WorkspaceEmptyState
              title="All caught up"
              description="No fired tickets right now — new orders appear here the moment they are fired."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tickets.map((ticket) => {
                const minutes = elapsedMinutes(ticket.confirmedAt, now)
                const urgency =
                  minutes >= LATE_AFTER
                    ? 'border-destructive/60'
                    : minutes >= WARN_AFTER
                      ? 'border-amber-400/70'
                      : 'border-border'
                return (
                  <article
                    key={ticket.orderId}
                    className={cn(
                      'flex flex-col rounded-2xl border-2 bg-card p-4',
                      urgency,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold">
                          {ticket.orderNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.tableCode
                            ? `Table ${ticket.tableCode}`
                            : titleCase(ticket.orderType)}{' '}
                          · {ticket.guestCount} guest
                          {ticket.guestCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-sm font-bold tabular-nums',
                          minutes >= LATE_AFTER
                            ? 'border-destructive/50 bg-destructive/10 text-destructive'
                            : minutes >= WARN_AFTER
                              ? 'border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : 'border-border bg-muted/60',
                        )}
                      >
                        {formatElapsed(ticket.confirmedAt, now)}
                      </span>
                    </div>

                    {ticket.kitchenNotes || ticket.notes ? (
                      <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                        {ticket.kitchenNotes ?? ticket.notes}
                      </p>
                    ) : null}

                    <ul className="mt-3 flex flex-1 flex-col divide-y divide-border/60">
                      {ticket.items.map((item) => (
                        <li key={item.id} className="py-2">
                          <button
                            type="button"
                            disabled={!canProgress || item.status === 'SERVED'}
                            onClick={() =>
                              advanceItem(ticket.orderId, item.id, item.status)
                            }
                            className="flex w-full min-h-11 items-center justify-between gap-2 text-left"
                          >
                            <span className="text-sm font-semibold">
                              {item.quantity} × {item.name}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-bold uppercase',
                                ITEM_STATUS_CHIP[item.status] ??
                                  ITEM_STATUS_CHIP.PENDING,
                              )}
                            >
                              {item.status.toLowerCase()}
                            </span>
                          </button>
                          {item.modifiers.length > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {item.modifiers
                                .map((modifier) => modifier.name)
                                .join(', ')}
                            </p>
                          ) : null}
                          {item.specialRequest ? (
                            <p className="text-xs font-medium italic text-amber-700 dark:text-amber-300">
                              “{item.specialRequest}”
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>

                    {stationId && ticket.items.length < ticket.totalItemCount ? (
                      <p className="mt-1 text-[0.68rem] text-muted-foreground">
                        {ticket.items.length} of {ticket.totalItemCount} items at
                        this station
                      </p>
                    ) : null}

                    {canProgress ? (
                      <div className="mt-3 flex gap-2 border-t border-border pt-3">
                        {ticket.status === 'CONFIRMED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => bulk(ticket.orderId, 'PREPARING')}
                          >
                            <Play data-icon="inline-start" /> Start
                          </Button>
                        ) : null}
                        {ticket.status !== 'READY' ? (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => bulk(ticket.orderId, 'READY')}
                          >
                            <ChefHat data-icon="inline-start" /> All ready
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mutations.updateItemStatus.isPending}
                              onClick={() =>
                                recall(
                                  ticket.orderId,
                                  ticket.items
                                    .filter((item) => item.status === 'READY')
                                    .map((item) => item.id),
                                )
                              }
                            >
                              <Undo2 data-icon="inline-start" /> Recall
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={mutations.transition.isPending}
                              onClick={() => bump(ticket.orderId)}
                            >
                              <CheckCheck data-icon="inline-start" /> Bump · served
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}
