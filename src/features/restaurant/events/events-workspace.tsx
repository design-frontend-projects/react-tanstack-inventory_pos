'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import {
  CalendarScheduler,
} from '#/components/scheduler/calendar-scheduler'
import type { SchedulerView } from '#/components/scheduler/calendar-scheduler'
import { FloorDesigner } from '#/components/floor/floor-designer'
import type { FloorItem } from '#/components/floor/floor-designer'
import { FormWizard } from '#/components/forms/form-wizard'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useEventMutations,
  useRestaurantEvents,
} from '#/features/restaurant/events/use-events'
import { useDiningAreas } from '#/features/restaurant/floor/use-floor'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  errorMessage,
  formatMoney,
  titleCase,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

const EVENT_STATUS_TONE: Record<string, StatusTone> = {
  INQUIRY: 'neutral',
  QUOTED: 'info',
  CONFIRMED: 'primary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

const NEXT_STATUS: Partial<Record<string, Array<string>>> = {
  INQUIRY: ['QUOTED', 'CONFIRMED', 'CANCELLED'],
  QUOTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
}

const EVENT_KINDS = [
  'BIRTHDAY',
  'CORPORATE',
  'WEDDING',
  'FAMILY',
  'GRADUATION',
  'VIP',
  'HOLIDAY',
  'PRIVATE',
]

interface EventRow {
  id: string
  code: string
  name: string
  kind: string
  status: string
  startsAt: string | Date
  endsAt: string | Date
  guestCount: number
  quoteAmount: string
  paidAmount: string
  notes: string | null
  tasks: Array<{ id: string; title: string; status: string }>
  payments: Array<{
    id: string
    kind: string
    amount: string
    method: string
  }>
  party: {
    theme: string | null
    seatingJson: unknown
    costAmount: string
    revenueAmount: string
  } | null
}

export function EventsWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.events.manage')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const [anchorDate, setAnchorDate] = React.useState(() => new Date())
  const [view, setView] = React.useState<SchedulerView>('month')

  // Load a generous window around the anchor month.
  const range = React.useMemo(() => {
    const from = new Date(anchorDate)
    from.setDate(1)
    from.setMonth(from.getMonth() - 1)
    const to = new Date(anchorDate)
    to.setDate(1)
    to.setMonth(to.getMonth() + 2)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [anchorDate])

  const eventsQuery = useRestaurantEvents(
    branchId ? { branchId, ...range } : null,
  )
  const areasQuery = useDiningAreas(branchId)
  const mutations = useEventMutations()
  useRestaurantRealtime()

  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [payOpen, setPayOpen] = React.useState(false)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const events = (eventsQuery.data ?? []) as Array<EventRow>
  const selected = events.find((event) => event.id === selectedId) ?? null
  const halls = areasQuery.data ?? []

  const upcoming = events.filter(
    (event) =>
      new Date(event.startsAt) > new Date() &&
      !['CANCELLED', 'COMPLETED'].includes(event.status),
  )
  const bookedRevenue = events
    .filter((event) => !['CANCELLED'].includes(event.status))
    .reduce((sum, event) => sum + Number(event.quoteAmount), 0)

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  async function submitWizard() {
    setError(null)
    try {
      const startsAt = new Date(field('startsAt'))
      const durationHours = Number(field('durationHours') || '4')
      const endsAt = new Date(
        startsAt.getTime() + durationHours * 60 * 60_000,
      )
      const created = await mutations.createEvent.mutateAsync({
        branchId: branchId as string,
        kind: (field('kind') || 'PRIVATE') as never,
        name: field('name'),
        hallId: field('hallId') || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        guestCount: Number(field('guestCount') || '20'),
        packageJson: {
          package: field('package') || null,
          menu: field('menu') || null,
          decorations: field('decorations') || null,
        },
        quoteAmount: field('quoteAmount') || '0',
        notes: field('notes') || null,
      })
      setWizardOpen(false)
      setSelectedId(created.id)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
      throw submitError
    }
  }

  async function transition(id: string, toStatus: string) {
    setError(null)
    try {
      await mutations.transitionEvent.mutateAsync({
        id,
        toStatus: toStatus as never,
      })
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  // Party seating layout stored as normalized FloorItems in seatingJson.
  const seatingItems: Array<FloorItem> = React.useMemo(() => {
    const raw = selected?.party?.seatingJson
    return Array.isArray(raw) ? (raw as Array<FloorItem>) : []
  }, [selected])

  async function saveSeating(items: Array<FloorItem>) {
    if (!selected) return
    try {
      await mutations.saveParty.mutateAsync({
        eventId: selected.id,
        theme: selected.party?.theme ?? null,
        seatingJson: items,
      })
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <AccessGuard
      permissions={['res.events.view', 'res.events.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need events access to manage bookings."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Functions"
        title="Events & parties."
        description="Bookings on a calendar, a guided wizard, task checklists, deposits, and party hall layouts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            {canManage ? (
              <Button
                type="button"
                onClick={() => {
                  setFields({
                    kind: 'PRIVATE',
                    guestCount: '20',
                    durationHours: '4',
                  })
                  setError(null)
                  setWizardOpen(true)
                }}
              >
                New booking
              </Button>
            ) : null}
          </div>
        }
        metrics={[
          {
            label: 'Upcoming',
            value: eventsQuery.data ? String(upcoming.length) : '—',
            hint: 'Booked ahead',
            tone: 'red',
          },
          {
            label: 'Booked value',
            value: eventsQuery.data ? formatMoney(String(bookedRevenue)) : '—',
            hint: 'Quotes in window',
            tone: 'accent',
          },
          {
            label: 'In window',
            value: eventsQuery.data ? String(events.length) : '—',
            hint: 'All statuses',
            tone: 'neutral',
          },
        ]}
      >
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <WorkspacePanel
          eyebrow="Schedule"
          title="Event calendar"
          description="Click an event to open it; click a day to start a booking."
        >
          <CalendarScheduler
            events={events.map((event) => ({
              id: event.id,
              startsAt: String(event.startsAt),
              title: event.name,
              subtitle: `${titleCase(event.kind)} · ${event.guestCount} guests`,
              tone: EVENT_STATUS_TONE[event.status],
            }))}
            view={view}
            onViewChange={setView}
            anchorDate={anchorDate}
            onAnchorDateChange={setAnchorDate}
            onEventClick={(schedulerEvent) => setSelectedId(schedulerEvent.id)}
            onSlotClick={(date) => {
              if (canManage) {
                const local = new Date(
                  date.getTime() - date.getTimezoneOffset() * 60_000,
                )
                setFields({
                  kind: 'PRIVATE',
                  guestCount: '20',
                  durationHours: '4',
                  startsAt: local.toISOString().slice(0, 16),
                })
                setError(null)
                setWizardOpen(true)
              }
            }}
          />
        </WorkspacePanel>
      </WorkspacePage>

      {/* Booking wizard */}
      <Sheet open={wizardOpen} onOpenChange={setWizardOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>New event booking</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <FormWizard
              steps={[
                {
                  id: 'basics',
                  title: 'Basics',
                  validate: () =>
                    !field('name')
                      ? 'Give the event a name'
                      : !field('startsAt')
                        ? 'Pick a start time'
                        : null,
                },
                { id: 'package', title: 'Package' },
                {
                  id: 'money',
                  title: 'Quote',
                  validate: () =>
                    field('quoteAmount') &&
                    Number.isNaN(Number(field('quoteAmount')))
                      ? 'Quote must be a number'
                      : null,
                },
                { id: 'review', title: 'Review' },
              ]}
              renderStep={(step) => {
                if (step.id === 'basics') {
                  return (
                    <div className="flex flex-col gap-4">
                      <Field label="Event name" required>
                        <input
                          className={fieldInputClassName}
                          value={field('name')}
                          onChange={(event) =>
                            setField('name', event.target.value)
                          }
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Type">
                          <select
                            className={fieldInputClassName}
                            value={field('kind')}
                            onChange={(event) =>
                              setField('kind', event.target.value)
                            }
                          >
                            {EVENT_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {titleCase(kind)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Guests">
                          <input
                            className={fieldInputClassName}
                            type="number"
                            min={1}
                            value={field('guestCount')}
                            onChange={(event) =>
                              setField('guestCount', event.target.value)
                            }
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Starts" required>
                          <input
                            className={fieldInputClassName}
                            type="datetime-local"
                            value={field('startsAt')}
                            onChange={(event) =>
                              setField('startsAt', event.target.value)
                            }
                          />
                        </Field>
                        <Field label="Duration (hours)">
                          <input
                            className={fieldInputClassName}
                            type="number"
                            min={1}
                            max={24}
                            value={field('durationHours')}
                            onChange={(event) =>
                              setField('durationHours', event.target.value)
                            }
                          />
                        </Field>
                      </div>
                      <Field
                        label="Hall / area"
                        hint="Conflicts are checked on booking"
                      >
                        <select
                          className={fieldInputClassName}
                          value={field('hallId')}
                          onChange={(event) =>
                            setField('hallId', event.target.value)
                          }
                        >
                          <option value="">No specific hall</option>
                          {halls.map((hall) => (
                            <option key={hall.id} value={hall.id}>
                              {hall.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )
                }
                if (step.id === 'package') {
                  return (
                    <div className="flex flex-col gap-4">
                      <Field label="Package">
                        <input
                          className={fieldInputClassName}
                          placeholder="e.g. Gold buffet"
                          value={field('package')}
                          onChange={(event) =>
                            setField('package', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Menu selection">
                        <input
                          className={fieldInputClassName}
                          placeholder="e.g. 3-course set, kids menu"
                          value={field('menu')}
                          onChange={(event) =>
                            setField('menu', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Decorations / theme">
                        <input
                          className={fieldInputClassName}
                          value={field('decorations')}
                          onChange={(event) =>
                            setField('decorations', event.target.value)
                          }
                        />
                      </Field>
                    </div>
                  )
                }
                if (step.id === 'money') {
                  return (
                    <div className="flex flex-col gap-4">
                      <Field label="Quote amount">
                        <input
                          className={fieldInputClassName}
                          type="number"
                          min={0}
                          step="0.01"
                          value={field('quoteAmount')}
                          onChange={(event) =>
                            setField('quoteAmount', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Notes">
                        <textarea
                          className={cn(fieldInputClassName, 'h-24 py-2')}
                          value={field('notes')}
                          onChange={(event) =>
                            setField('notes', event.target.value)
                          }
                        />
                      </Field>
                    </div>
                  )
                }
                return (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                    <dt className="text-muted-foreground">Event</dt>
                    <dd className="font-semibold">{field('name') || '—'}</dd>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>{titleCase(field('kind') || 'PRIVATE')}</dd>
                    <dt className="text-muted-foreground">Starts</dt>
                    <dd>{field('startsAt') || '—'}</dd>
                    <dt className="text-muted-foreground">Guests</dt>
                    <dd>{field('guestCount') || '20'}</dd>
                    <dt className="text-muted-foreground">Package</dt>
                    <dd>{field('package') || '—'}</dd>
                    <dt className="text-muted-foreground">Quote</dt>
                    <dd className="font-semibold">
                      {formatMoney(field('quoteAmount') || '0')}
                    </dd>
                  </dl>
                )
              }}
              onComplete={submitWizard}
              onCancel={() => setWizardOpen(false)}
              completeLabel="Book event"
              isPending={mutations.createEvent.isPending}
              error={error}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Event detail */}
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  {selected.name}
                  <StatusChip
                    tone={EVENT_STATUS_TONE[selected.status]}
                    dot
                  >
                    {titleCase(selected.status)}
                  </StatusChip>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-4 pb-6">
                <p className="text-sm text-muted-foreground">
                  {selected.code} · {titleCase(selected.kind)} ·{' '}
                  {selected.guestCount} guests ·{' '}
                  {new Date(String(selected.startsAt)).toLocaleString()} ·
                  quote {formatMoney(selected.quoteAmount)} · paid{' '}
                  {formatMoney(selected.paidAmount)}
                </p>

                {canManage
                  ? (() => {
                      const nextStatuses = NEXT_STATUS[selected.status]
                      return nextStatuses?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {nextStatuses.map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant={
                                status === 'CANCELLED' ? 'ghost' : 'outline'
                              }
                              disabled={mutations.transitionEvent.isPending}
                              onClick={() => transition(selected.id, status)}
                            >
                              {titleCase(status)}
                            </Button>
                          ))}
                        </div>
                      ) : null
                    })()
                  : null}

                {/* Task checklist */}
                <section>
                  <h3 className="ops-kicker mb-2">Checklist</h3>
                  <ul className="flex flex-col gap-1.5">
                    {selected.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() =>
                            void mutations.setTaskStatus.mutateAsync({
                              taskId: task.id,
                              status: task.status === 'DONE' ? 'TODO' : 'DONE',
                            })
                          }
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-start text-sm',
                            task.status === 'DONE' &&
                              'text-muted-foreground line-through',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'flex size-4 items-center justify-center rounded-full border text-[0.6rem] font-bold',
                              task.status === 'DONE'
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-border',
                            )}
                          >
                            {task.status === 'DONE' ? '✓' : ''}
                          </span>
                          {task.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Payments */}
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="ops-kicker">Payments</h3>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFields({ payKind: 'DEPOSIT' })
                          setPayOpen(true)
                        }}
                      >
                        Add payment
                      </Button>
                    ) : null}
                  </div>
                  {selected.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No payments recorded.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {selected.payments.map((payment) => (
                        <li
                          key={payment.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <StatusChip
                              tone={
                                payment.kind === 'REFUND' ? 'danger' : 'success'
                              }
                            >
                              {titleCase(payment.kind)}
                            </StatusChip>
                            <span className="text-xs text-muted-foreground">
                              {payment.method}
                            </span>
                          </span>
                          <strong className="tabular-nums">
                            {formatMoney(payment.amount)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Party hall layout */}
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="ops-kicker">Party seating</h3>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void saveSeating([
                            ...seatingItems,
                            {
                              id: `t-${seatingItems.length + 1}-${selected.id.slice(0, 4)}`,
                              label: `T${seatingItems.length + 1}`,
                              sublabel: '8 seats',
                              shape:
                                seatingItems.length % 2 === 0
                                  ? 'round'
                                  : 'rect',
                              x: 0.2 + (seatingItems.length % 4) * 0.2,
                              y: 0.25 + Math.floor(seatingItems.length / 4) * 0.25,
                              w: 0.12,
                              h: 0.16,
                            },
                          ])
                        }
                      >
                        Add table
                      </Button>
                    ) : null}
                  </div>
                  <FloorDesigner
                    items={seatingItems}
                    onItemChange={
                      canManage
                        ? (item) =>
                            void saveSeating(
                              seatingItems.map((existing) =>
                                existing.id === item.id ? item : existing,
                              ),
                            )
                        : undefined
                    }
                    aspect={16 / 9}
                    emptyLabel="No seating layout yet — add tables to sketch the hall."
                  />
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Add payment drawer */}
      <DrawerForm
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Record payment"
        onSubmit={async () => {
          if (!selected) return
          setError(null)
          try {
            await mutations.addPayment.mutateAsync({
              eventId: selected.id,
              kind: (field('payKind') || 'DEPOSIT') as never,
              amount: field('payAmount'),
              method: field('payMethod') || 'cash',
              reference: field('payReference') || null,
            })
            setPayOpen(false)
          } catch (submitError: unknown) {
            setError(errorMessage(submitError))
          }
        }}
        isPending={mutations.addPayment.isPending}
        error={error}
        submitLabel="Record"
      >
        <Field label="Kind">
          <select
            className={fieldInputClassName}
            value={field('payKind')}
            onChange={(event) => setField('payKind', event.target.value)}
          >
            {['DEPOSIT', 'INSTALLMENT', 'FINAL', 'REFUND'].map((kind) => (
              <option key={kind} value={kind}>
                {titleCase(kind)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount" required>
          <input
            className={fieldInputClassName}
            type="number"
            min={0}
            step="0.01"
            value={field('payAmount')}
            onChange={(event) => setField('payAmount', event.target.value)}
            required
          />
        </Field>
        <Field label="Method">
          <input
            className={fieldInputClassName}
            placeholder="cash / card / transfer"
            value={field('payMethod')}
            onChange={(event) => setField('payMethod', event.target.value)}
          />
        </Field>
        <Field label="Reference">
          <input
            className={fieldInputClassName}
            value={field('payReference')}
            onChange={(event) => setField('payReference', event.target.value)}
          />
        </Field>
      </DrawerForm>
    </AccessGuard>
  )
}
