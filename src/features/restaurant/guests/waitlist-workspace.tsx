'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
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
  useWaitlist,
} from '#/features/restaurant/guests/use-guests'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  errorMessage,
  formatElapsed,
  titleCase,
  useNowTick,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

const PRIORITY_TONE: Record<string, StatusTone> = {
  VIP: 'primary',
  FAMILY: 'warning',
  NORMAL: 'neutral',
}

export function WaitlistWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.reservations.manage')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const waitlistQuery = useWaitlist(branchId)
  const mutations = useGuestMutations()
  useRestaurantRealtime()
  const now = useNowTick(15_000)

  const [addOpen, setAddOpen] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const entries = waitlistQuery.data ?? []
  const waiting = entries.filter((entry) => entry.status === 'WAITING')
  const notified = entries.filter((entry) => entry.status === 'NOTIFIED')
  const overQuote = entries.filter((entry) => {
    const waited =
      (now - new Date(entry.createdAt).getTime()) / 60_000
    return entry.status === 'WAITING' && waited > entry.quotedMinutes
  })

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  async function submitAdd() {
    setFormError(null)
    try {
      await mutations.addWaitlistEntry.mutateAsync({
        branchId: branchId as string,
        guestName: field('guestName'),
        guestPhone: field('guestPhone') || null,
        partySize: Number(field('partySize') || '2'),
        priority: (field('priority') || 'NORMAL') as never,
        quotedMinutes: Number(field('quotedMinutes') || '15'),
        notes: field('notes') || null,
      })
      setAddOpen(false)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  async function act(id: string, toStatus: 'NOTIFIED' | 'SEATED' | 'LEFT') {
    setFormError(null)
    try {
      await mutations.updateWaitlistStatus.mutateAsync({ id, toStatus })
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  return (
    <AccessGuard
      permissions={['res.reservations.view', 'res.reservations.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need reservations access to run the waitlist."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Guests"
        title="Waitlist."
        description="Walk-in queue with priority lanes. Notify when the table is close, seat with one tap."
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
                  setFields({ partySize: '2', quotedMinutes: '15', priority: 'NORMAL' })
                  setFormError(null)
                  setAddOpen(true)
                }}
              >
                Add guest
              </Button>
            ) : null}
          </div>
        }
        metrics={[
          {
            label: 'Waiting',
            value: waitlistQuery.data ? String(waiting.length) : '—',
            hint: 'In the queue',
            tone: 'red',
          },
          {
            label: 'Notified',
            value: waitlistQuery.data ? String(notified.length) : '—',
            hint: 'Table nearly ready',
            tone: 'accent',
          },
          {
            label: 'Over quote',
            value: waitlistQuery.data ? String(overQuote.length) : '—',
            hint: 'Waited past the estimate',
            tone: 'neutral',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Queue"
          title="Current queue"
          description="VIP first, then family, then arrival order."
        >
          {formError ? (
            <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          {waitlistQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading queue…</p>
          ) : waitlistQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load the waitlist"
              description="Check your connection and permissions, then retry."
            />
          ) : entries.length === 0 ? (
            <WorkspaceEmptyState
              title="Queue is empty"
              description="Walk-in guests appear here as the host adds them."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((entry, index) => {
                const waitedMs =
                  now - new Date(entry.createdAt).getTime()
                const late =
                  entry.status === 'WAITING' &&
                  waitedMs / 60_000 > entry.quotedMinutes
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2.5',
                      late ? 'border-destructive/50' : 'border-border',
                    )}
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {entry.guestName}
                        <span className="font-normal text-muted-foreground">
                          ×{entry.partySize}
                        </span>
                        <StatusChip
                          tone={PRIORITY_TONE[entry.priority] ?? 'neutral'}
                        >
                          {titleCase(entry.priority)}
                        </StatusChip>
                        <StatusChip
                          tone={entry.status === 'NOTIFIED' ? 'info' : 'neutral'}
                          dot
                        >
                          {titleCase(entry.status)}
                        </StatusChip>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Waited {formatElapsed(String(entry.createdAt), now)} ·
                        quoted {entry.quotedMinutes}m
                        {entry.guestPhone ? ` · ${entry.guestPhone}` : ''}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex gap-1.5">
                        {entry.status === 'WAITING' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => act(entry.id, 'NOTIFIED')}
                          >
                            Notify
                          </Button>
                        ) : null}
                        <Button size="sm" onClick={() => act(entry.id, 'SEATED')}>
                          Seat
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => act(entry.id, 'LEFT')}
                        >
                          Left
                        </Button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </WorkspacePanel>
      </WorkspacePage>

      <DrawerForm
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add to waitlist"
        description="Quote a realistic wait — the row flags itself when it runs over."
        onSubmit={submitAdd}
        isPending={mutations.addWaitlistEntry.isPending}
        error={formError}
        submitLabel="Add guest"
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
          <Field label="Party size">
            <input
              className={fieldInputClassName}
              type="number"
              min={1}
              value={field('partySize')}
              onChange={(event) => setField('partySize', event.target.value)}
            />
          </Field>
          <Field label="Quoted minutes">
            <input
              className={fieldInputClassName}
              type="number"
              min={0}
              step={5}
              value={field('quotedMinutes')}
              onChange={(event) =>
                setField('quotedMinutes', event.target.value)
              }
            />
          </Field>
        </div>
        <Field label="Priority">
          <select
            className={fieldInputClassName}
            value={field('priority') || 'NORMAL'}
            onChange={(event) => setField('priority', event.target.value)}
          >
            <option value="NORMAL">Normal</option>
            <option value="FAMILY">Family</option>
            <option value="VIP">VIP</option>
          </select>
        </Field>
        <Field label="Notes">
          <input
            className={fieldInputClassName}
            value={field('notes')}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </Field>
      </DrawerForm>
    </AccessGuard>
  )
}
