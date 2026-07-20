'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { FilterTabs } from '#/components/data/filter-bar'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { StatusChip } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useGuestMutations,
  useTakeawayBoard,
} from '#/features/restaurant/guests/use-guests'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  StatusPill,
  errorMessage,
  formatMoney,
  useNowTick,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

type TakeawayTab = 'queue' | 'ready' | 'done'

export function TakeawayWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage =
    hasPermission(permissions, 'res.takeaway.manage') ||
    hasPermission(permissions, 'res.orders.update')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const boardQuery = useTakeawayBoard(branchId)
  const mutations = useGuestMutations()
  useRestaurantRealtime()
  const now = useNowTick(15_000)

  const [tab, setTab] = React.useState<TakeawayTab>('queue')
  const [error, setError] = React.useState<string | null>(null)
  const [pickupFor, setPickupFor] = React.useState<string | null>(null)
  const [promisedAt, setPromisedAt] = React.useState('')
  const [handOver, setHandOver] = React.useState<{
    pickupId: string
    orderNumber: string
  } | null>(null)
  const [codeInput, setCodeInput] = React.useState('')

  const rows = boardQuery.data ?? []
  const queue = rows.filter(
    (row) => !row.pickup?.pickedUpAt && row.status !== 'COMPLETED',
  )
  const ready = rows.filter(
    (row) =>
      ['READY', 'SERVED'].includes(row.status) && !row.pickup?.pickedUpAt,
  )
  const done = rows.filter(
    (row) => row.pickup?.pickedUpAt || row.status === 'COMPLETED',
  )

  const visible = tab === 'queue' ? queue : tab === 'ready' ? ready : done

  async function stamp(
    pickupId: string,
    action: 'PACKED' | 'NOTIFIED' | 'PICKED_UP',
    verificationCode?: string,
  ) {
    setError(null)
    try {
      await mutations.stampPickup.mutateAsync({
        id: pickupId,
        action,
        verificationCode: verificationCode ?? null,
      })
      if (action === 'PICKED_UP') {
        setHandOver(null)
        setCodeInput('')
      }
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  async function submitPickup() {
    if (!pickupFor) return
    setError(null)
    try {
      await mutations.createPickup.mutateAsync({
        branchId: branchId as string,
        orderId: pickupFor,
        promisedAt: new Date(promisedAt).toISOString(),
      })
      setPickupFor(null)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <AccessGuard
      permissions={['res.takeaway.view', 'res.takeaway.manage', 'res.orders.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need takeaway access to run the pickup counter."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Guests"
        title="Takeaway counter."
        description="Pickup queue with promised times, packing, SMS-notify seam, and code-verified hand-over."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            <FilterTabs
              tabs={[
                { value: 'queue', label: 'Queue', count: queue.length },
                { value: 'ready', label: 'Ready', count: ready.length },
                { value: 'done', label: 'Picked up', count: done.length },
              ]}
              value={tab}
              onChange={(value) => setTab(value as TakeawayTab)}
            />
          </div>
        }
        metrics={[
          {
            label: 'In queue',
            value: boardQuery.data ? String(queue.length) : '—',
            hint: 'Takeaway orders open',
            tone: 'red',
          },
          {
            label: 'Ready',
            value: boardQuery.data ? String(ready.length) : '—',
            hint: 'Awaiting pickup',
            tone: 'accent',
          },
          {
            label: 'Late',
            value: boardQuery.data
              ? String(
                  queue.filter(
                    (row) =>
                      row.pickup &&
                      new Date(row.pickup.promisedAt).getTime() < now,
                  ).length,
                )
              : '—',
            hint: 'Past promised time',
            tone: 'neutral',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Counter"
          title="Pickup tickets"
          description="Pack → notify → verify the guest's code at hand-over."
        >
          {error && !pickupFor && !handOver ? (
            <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {boardQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tickets…</p>
          ) : visible.length === 0 ? (
            <WorkspaceEmptyState
              title="Nothing here"
              description="Takeaway and pickup orders appear as they are created."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((row) => {
                const late =
                  row.pickup &&
                  !row.pickup.pickedUpAt &&
                  new Date(row.pickup.promisedAt).getTime() < now
                return (
                  <article
                    key={row.orderId}
                    className={cn(
                      'flex flex-col gap-2 rounded-2xl border-2 bg-card p-4',
                      late ? 'border-destructive/60' : 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold">{row.orderNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(row.grandTotal, row.currencyCode)} ·{' '}
                          {Number(row.amountPaid) >= Number(row.grandTotal)
                            ? 'Paid'
                            : 'Unpaid'}
                        </p>
                      </div>
                      <StatusPill status={row.status} />
                    </div>

                    {row.pickup ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <StatusChip tone={late ? 'danger' : 'info'} dot>
                            Promised{' '}
                            {new Date(row.pickup.promisedAt).toLocaleTimeString(
                              undefined,
                              { hour: '2-digit', minute: '2-digit' },
                            )}
                          </StatusChip>
                          {row.pickup.packedAt ? (
                            <StatusChip tone="success">Packed</StatusChip>
                          ) : null}
                          {row.pickup.notifiedAt ? (
                            <StatusChip tone="primary">Notified</StatusChip>
                          ) : null}
                          {row.pickup.pickedUpAt ? (
                            <StatusChip tone="neutral">Picked up</StatusChip>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Code:{' '}
                          <strong className="tabular-nums">
                            {row.pickup.verificationCode}
                          </strong>
                        </p>
                        {canManage && !row.pickup.pickedUpAt ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {!row.pickup.packedAt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => stamp(row.pickup!.id, 'PACKED')}
                              >
                                Packed
                              </Button>
                            ) : null}
                            {!row.pickup.notifiedAt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => stamp(row.pickup!.id, 'NOTIFIED')}
                              >
                                Notify
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              onClick={() => {
                                setHandOver({
                                  pickupId: row.pickup!.id,
                                  orderNumber: row.orderNumber,
                                })
                                setCodeInput('')
                                setError(null)
                              }}
                            >
                              Hand over
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const soon = new Date(Date.now() + 20 * 60_000)
                          setPromisedAt(
                            new Date(
                              soon.getTime() -
                                soon.getTimezoneOffset() * 60_000,
                            )
                              .toISOString()
                              .slice(0, 16),
                          )
                          setPickupFor(row.orderId)
                          setError(null)
                        }}
                      >
                        Create pickup ticket
                      </Button>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePage>

      {/* Create pickup drawer */}
      <DrawerForm
        open={Boolean(pickupFor)}
        onOpenChange={(open) => {
          if (!open) setPickupFor(null)
        }}
        title="Pickup ticket"
        description="A 4-digit verification code is generated for the guest."
        onSubmit={submitPickup}
        isPending={mutations.createPickup.isPending}
        error={error}
        submitLabel="Create ticket"
      >
        <Field label="Promised time" required>
          <input
            className={fieldInputClassName}
            type="datetime-local"
            value={promisedAt}
            onChange={(event) => setPromisedAt(event.target.value)}
            required
          />
        </Field>
      </DrawerForm>

      {/* Hand-over verification drawer */}
      <DrawerForm
        open={Boolean(handOver)}
        onOpenChange={(open) => {
          if (!open) setHandOver(null)
        }}
        title={handOver ? `Hand over ${handOver.orderNumber}` : ''}
        description="Ask the guest for their pickup code."
        onSubmit={async () => {
          if (handOver) {
            await stamp(handOver.pickupId, 'PICKED_UP', codeInput)
          }
        }}
        isPending={mutations.stampPickup.isPending}
        error={error}
        submitLabel="Verify & hand over"
        submitDisabled={codeInput.trim().length === 0}
      >
        <Field label="Verification code" required>
          <input
            className={cn(fieldInputClassName, 'text-center text-lg tracking-[0.4em]')}
            inputMode="numeric"
            maxLength={6}
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            required
          />
        </Field>
      </DrawerForm>
    </AccessGuard>
  )
}
