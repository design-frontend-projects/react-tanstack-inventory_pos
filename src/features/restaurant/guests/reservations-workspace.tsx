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
import type {
  SchedulerEvent,
  SchedulerView,
} from '#/components/scheduler/calendar-scheduler'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterTabs } from '#/components/data/filter-bar'
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
  useGuestMutations,
  useReservations,
} from '#/features/restaurant/guests/use-guests'
import { useTables } from '#/features/restaurant/guests/use-tables'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import { errorMessage, titleCase } from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

const STATUS_TONE: Record<string, StatusTone> = {
  REQUESTED: 'info',
  CONFIRMED: 'primary',
  SEATED: 'success',
  COMPLETED: 'neutral',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
}

interface ReservationRow {
  id: string
  code: string
  guestName: string
  guestPhone: string | null
  partySize: number
  requestedAt: string | Date
  durationMinutes: number
  status: string
  source: string
  notes: string | null
  tableIds: Array<string>
}

export function ReservationsWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.reservations.manage')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const [view, setView] = React.useState<'calendar' | 'list'>('calendar')
  const [calView, setCalView] = React.useState<SchedulerView>('week')
  const [anchor, setAnchor] = React.useState(() => new Date())

  // Window the query around the visible period.
  const range = React.useMemo(() => {
    const from = new Date(anchor)
    from.setDate(from.getDate() - 45)
    from.setHours(0, 0, 0, 0)
    const to = new Date(anchor)
    to.setDate(to.getDate() + 60)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [anchor])

  const reservationsQuery = useReservations(
    branchId ? { branchId, ...range } : null,
  )
  const tablesQuery = useTables(branchId)
  const mutations = useGuestMutations()
  useRestaurantRealtime()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<ReservationRow | null>(null)
  const [seatFor, setSeatFor] = React.useState<ReservationRow | null>(null)
  const [seatTables, setSeatTables] = React.useState<Array<string>>([])
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const reservations = (reservationsQuery.data ?? []) as Array<ReservationRow>
  const tableById = new Map(
    (tablesQuery.data ?? []).map((table) => [table.id, table.code]),
  )

  const todayCount = reservations.filter((row) => {
    const date = new Date(row.requestedAt)
    const now = new Date()
    return date.toDateString() === now.toDateString()
  }).length
  const upcoming = reservations.filter((row) =>
    ['REQUESTED', 'CONFIRMED'].includes(row.status),
  ).length
  const seatedNow = reservations.filter((row) => row.status === 'SEATED').length

  const events: Array<SchedulerEvent> = reservations
    .filter((row) => !['CANCELLED', 'NO_SHOW'].includes(row.status))
    .map((row) => ({
      id: row.id,
      startsAt: new Date(row.requestedAt).toISOString(),
      durationMinutes: row.durationMinutes,
      title: `${row.guestName} ×${row.partySize}`,
      subtitle: row.code,
      tone: STATUS_TONE[row.status] ?? 'primary',
    }))

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  function openCreate(slot?: Date) {
    const start = slot ?? new Date()
    setFields({
      requestedAt: new Date(
        start.getTime() - start.getTimezoneOffset() * 60_000,
      )
        .toISOString()
        .slice(0, 16),
      partySize: '2',
      durationMinutes: '90',
      source: 'PHONE',
    })
    setFormError(null)
    setCreateOpen(true)
  }

  async function submitCreate() {
    setFormError(null)
    try {
      await mutations.createReservation.mutateAsync({
        branchId: branchId as string,
        guestName: field('guestName'),
        guestPhone: field('guestPhone') || null,
        partySize: Number(field('partySize') || '2'),
        requestedAt: new Date(field('requestedAt')).toISOString(),
        durationMinutes: Number(field('durationMinutes') || '90'),
        source: (field('source') || 'PHONE') as never,
        notes: field('notes') || null,
      })
      setCreateOpen(false)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  async function act(
    row: ReservationRow,
    toStatus: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED',
  ) {
    setFormError(null)
    try {
      await mutations.transitionReservation.mutateAsync({
        id: row.id,
        toStatus,
      })
      setSelected(null)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  async function submitSeat() {
    if (!seatFor) return
    setFormError(null)
    try {
      await mutations.seatReservation.mutateAsync({
        id: seatFor.id,
        tableIds: seatTables,
        openOrder: true,
      })
      setSeatFor(null)
      setSelected(null)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<ReservationRow>> = [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => row.code,
      sortValue: (row) => row.code,
    },
    {
      id: 'guest',
      header: 'Guest',
      cell: (row) => (
        <span>
          <span className="font-medium">{row.guestName}</span>
          {row.guestPhone ? (
            <span className="ms-2 text-xs text-muted-foreground">
              {row.guestPhone}
            </span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.guestName,
    },
    {
      id: 'when',
      header: 'When',
      cell: (row) =>
        new Date(row.requestedAt).toLocaleString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      sortValue: (row) => new Date(row.requestedAt).getTime(),
    },
    {
      id: 'party',
      header: 'Party',
      align: 'end',
      cell: (row) => row.partySize,
      sortValue: (row) => row.partySize,
    },
    {
      id: 'tables',
      header: 'Tables',
      cell: (row) =>
        row.tableIds.length > 0
          ? row.tableIds
              .map((id) => tableById.get(id) ?? '—')
              .join(', ')
          : '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={STATUS_TONE[row.status] ?? 'neutral'} dot>
          {titleCase(row.status)}
        </StatusChip>
      ),
      sortValue: (row) => row.status,
    },
  ]

  return (
    <AccessGuard
      permissions={['res.reservations.view', 'res.reservations.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need reservations access to view bookings."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Guests"
        title="Reservations."
        description="Book, confirm, and seat parties. Seating opens a linked table order in one step."
        actions={
          <FilterBar>
            <BranchPicker
              branches={branches}
              branchId={branchId}
              onChange={setBranchId}
            />
            <FilterTabs
              tabs={[
                { value: 'calendar', label: 'Calendar' },
                { value: 'list', label: 'List' },
              ]}
              value={view}
              onChange={(value) => setView(value as 'calendar' | 'list')}
            />
            {canManage ? (
              <Button type="button" onClick={() => openCreate()}>
                New reservation
              </Button>
            ) : null}
          </FilterBar>
        }
        metrics={[
          {
            label: 'Today',
            value: reservationsQuery.data ? String(todayCount) : '—',
            hint: 'Bookings today',
            tone: 'red',
          },
          {
            label: 'Upcoming',
            value: reservationsQuery.data ? String(upcoming) : '—',
            hint: 'Requested + confirmed',
            tone: 'accent',
          },
          {
            label: 'Seated now',
            value: reservationsQuery.data ? String(seatedNow) : '—',
            hint: 'Parties in service',
            tone: 'neutral',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Book"
          title={view === 'calendar' ? 'Reservation calendar' : 'All reservations'}
          description="Click a booking to manage it; click an empty slot to book."
        >
          {formError && !createOpen && !seatFor ? (
            <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          {view === 'calendar' ? (
            <CalendarScheduler
              events={events}
              view={calView}
              onViewChange={setCalView}
              anchorDate={anchor}
              onAnchorDateChange={setAnchor}
              onEventClick={(event) => {
                const row = reservations.find((item) => item.id === event.id)
                if (row) setSelected(row)
              }}
              onSlotClick={(slot) => {
                if (canManage) openCreate(slot)
              }}
              dayStartHour={8}
              dayEndHour={24}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={reservations}
              rowKey={(row) => row.id}
              isLoading={reservationsQuery.isLoading}
              isError={reservationsQuery.isError}
              pageSize={15}
              onRowClick={(row) => setSelected(row)}
              emptyTitle="No reservations"
              emptyDescription="Bookings in the visible window appear here."
            />
          )}
        </WorkspacePanel>

        {/* Selected reservation action panel */}
        {selected ? (
          <WorkspacePanel
            eyebrow={selected.code}
            title={`${selected.guestName} — party of ${selected.partySize}`}
            description={`${new Date(selected.requestedAt).toLocaleString()} · ${titleCase(selected.source)}${selected.notes ? ` · ${selected.notes}` : ''}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone={STATUS_TONE[selected.status] ?? 'neutral'} dot>
                {titleCase(selected.status)}
              </StatusChip>
              {canManage && selected.status === 'REQUESTED' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(selected, 'CONFIRMED')}
                >
                  Confirm
                </Button>
              ) : null}
              {canManage &&
              ['REQUESTED', 'CONFIRMED'].includes(selected.status) ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSeatFor(selected)
                      setSeatTables(selected.tableIds)
                      setFormError(null)
                    }}
                  >
                    Seat now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act(selected, 'NO_SHOW')}
                  >
                    No-show
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act(selected, 'CANCELLED')}
                  >
                    Cancel booking
                  </Button>
                </>
              ) : null}
              {canManage && selected.status === 'SEATED' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(selected, 'COMPLETED')}
                >
                  Complete
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
          </WorkspacePanel>
        ) : null}
      </WorkspacePage>

      {/* Booking drawer */}
      <DrawerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New reservation"
        description="A code is issued automatically from the branch sequence."
        onSubmit={submitCreate}
        isPending={mutations.createReservation.isPending}
        error={formError}
        submitLabel="Book"
      >
        <Field label="Guest name" required>
          <input
            className={fieldInputClassName}
            value={field('guestName')}
            onChange={(event) => setField('guestName', event.target.value)}
            required
          />
        </Field>
        <Field label="Phone">
          <input
            className={fieldInputClassName}
            value={field('guestPhone')}
            onChange={(event) => setField('guestPhone', event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Party size" required>
            <input
              className={fieldInputClassName}
              type="number"
              min={1}
              value={field('partySize')}
              onChange={(event) => setField('partySize', event.target.value)}
            />
          </Field>
          <Field label="Duration (min)">
            <input
              className={fieldInputClassName}
              type="number"
              min={15}
              step={15}
              value={field('durationMinutes')}
              onChange={(event) =>
                setField('durationMinutes', event.target.value)
              }
            />
          </Field>
        </div>
        <Field label="Date & time" required>
          <input
            className={fieldInputClassName}
            type="datetime-local"
            value={field('requestedAt')}
            onChange={(event) => setField('requestedAt', event.target.value)}
            required
          />
        </Field>
        <Field label="Source">
          <select
            className={fieldInputClassName}
            value={field('source') || 'PHONE'}
            onChange={(event) => setField('source', event.target.value)}
          >
            {['PHONE', 'WALK_IN', 'QR', 'ONLINE'].map((source) => (
              <option key={source} value={source}>
                {titleCase(source)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea
            className={cn(fieldInputClassName, 'h-20 py-2')}
            value={field('notes')}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </Field>
      </DrawerForm>

      {/* Seat drawer */}
      <DrawerForm
        open={Boolean(seatFor)}
        onOpenChange={(open) => {
          if (!open) setSeatFor(null)
        }}
        title={seatFor ? `Seat ${seatFor.guestName}` : ''}
        description="Pick the table(s); a dine-in order opens on the first one."
        onSubmit={submitSeat}
        isPending={mutations.seatReservation.isPending}
        error={formError}
        submitLabel="Seat party"
        submitDisabled={seatTables.length === 0}
      >
        <div className="flex flex-wrap gap-2">
          {(tablesQuery.data ?? []).map((table) => {
            const active = seatTables.includes(table.id)
            return (
              <button
                key={table.id}
                type="button"
                onClick={() =>
                  setSeatTables((current) =>
                    active
                      ? current.filter((id) => id !== table.id)
                      : [...current, table.id],
                  )
                }
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : table.status === 'AVAILABLE'
                      ? 'border-border bg-card hover:border-primary/40'
                      : 'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                {table.code}
                <span className="ms-1 text-xs font-normal text-muted-foreground">
                  ×{table.seats}
                </span>
              </button>
            )
          })}
        </div>
      </DrawerForm>
    </AccessGuard>
  )
}
