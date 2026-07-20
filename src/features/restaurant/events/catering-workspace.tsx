'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
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
  useCateringJobs,
  useEventMutations,
} from '#/features/restaurant/events/use-events'
import { BranchPicker } from '#/features/restaurant/shared/branch-picker'
import {
  errorMessage,
  formatMoney,
  titleCase,
} from '#/features/restaurant/shared/format'
import { useBranchSelection } from '#/features/restaurant/shared/use-branches'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'

const CATERING_TONE: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  PREPPING: 'warning',
  DISPATCHED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

const NEXT_STATUS: Partial<Record<string, Array<string>>> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPPING', 'CANCELLED'],
  PREPPING: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['COMPLETED'],
}

interface CateringRow {
  id: string
  code: string
  name: string
  kind: string
  status: string
  eventDate: string | Date
  guestCount: number
  quoteAmount: string
  costAmount: string
  addressLine: string | null
}

export function CateringWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.catering.manage')

  const { branches, branchId, setBranchId } = useBranchSelection()
  const jobsQuery = useCateringJobs(branchId)
  const mutations = useEventMutations()
  useRestaurantRealtime()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const jobs = (jobsQuery.data ?? []) as Array<CateringRow>
  const active = jobs.filter(
    (job) => !['COMPLETED', 'CANCELLED'].includes(job.status),
  )
  const pipeline = jobs
    .filter((job) => !['CANCELLED'].includes(job.status))
    .reduce((sum, job) => sum + Number(job.quoteAmount), 0)
  const margin = jobs
    .filter((job) => job.status === 'COMPLETED')
    .reduce(
      (sum, job) => sum + (Number(job.quoteAmount) - Number(job.costAmount)),
      0,
    )

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  async function submitCreate() {
    setError(null)
    try {
      await mutations.createCatering.mutateAsync({
        branchId: branchId as string,
        kind: (field('kind') || 'CORPORATE') as never,
        name: field('name'),
        eventDate: new Date(field('eventDate')).toISOString(),
        addressLine: field('addressLine') || null,
        guestCount: Number(field('guestCount') || '20'),
        quoteAmount: field('quoteAmount') || '0',
        costAmount: field('costAmount') || '0',
        notes: field('notes') || null,
      })
      setCreateOpen(false)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  const columns: Array<DataTableColumn<CateringRow>> = [
    {
      id: 'code',
      header: 'Job',
      cell: (row) => (
        <span className="font-semibold">
          {row.code}
          <span className="ms-2 font-normal text-muted-foreground">
            {row.name}
          </span>
        </span>
      ),
      sortValue: (row) => row.code,
    },
    { id: 'kind', header: 'Kind', cell: (row) => titleCase(row.kind) },
    {
      id: 'date',
      header: 'Date',
      cell: (row) => new Date(String(row.eventDate)).toLocaleDateString(),
      sortValue: (row) => String(row.eventDate),
    },
    {
      id: 'guests',
      header: 'Guests',
      align: 'end',
      cell: (row) => row.guestCount,
      sortValue: (row) => row.guestCount,
    },
    {
      id: 'quote',
      header: 'Quote',
      align: 'end',
      cell: (row) => formatMoney(row.quoteAmount),
      sortValue: (row) => Number(row.quoteAmount),
    },
    {
      id: 'cost',
      header: 'Cost',
      align: 'end',
      cell: (row) => formatMoney(row.costAmount),
      sortValue: (row) => Number(row.costAmount),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={CATERING_TONE[row.status]} dot>
          {titleCase(row.status)}
        </StatusChip>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      cell: (row) => {
        const nextStatuses = NEXT_STATUS[row.status]
        return canManage && nextStatuses?.length ? (
          <div className="flex justify-end gap-1">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                type="button"
                size="xs"
                variant={status === 'CANCELLED' ? 'ghost' : 'outline'}
                disabled={mutations.transitionCatering.isPending}
                onClick={(event) => {
                  event.stopPropagation()
                  setError(null)
                  void mutations.transitionCatering
                    .mutateAsync({ id: row.id, toStatus: status as never })
                    .catch((submitError: unknown) =>
                      setError(errorMessage(submitError)),
                    )
                }}
              >
                {titleCase(status)}
              </Button>
            ))}
          </div>
        ) : null
      },
    },
  ]

  return (
    <AccessGuard
      permissions={['res.catering.view', 'res.catering.manage', 'res.events.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need catering access to manage jobs."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Functions"
        title="Catering."
        description="Corporate, delivery, and outside-event jobs with quotes, costs, and a dispatch lifecycle."
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
                  setFields({ kind: 'CORPORATE', guestCount: '20' })
                  setError(null)
                  setCreateOpen(true)
                }}
              >
                New job
              </Button>
            ) : null}
          </div>
        }
        metrics={[
          {
            label: 'Active jobs',
            value: jobsQuery.data ? String(active.length) : '—',
            hint: 'Draft through dispatched',
            tone: 'red',
          },
          {
            label: 'Pipeline',
            value: jobsQuery.data ? formatMoney(String(pipeline)) : '—',
            hint: 'Quoted value',
            tone: 'accent',
          },
          {
            label: 'Realized margin',
            value: jobsQuery.data ? formatMoney(String(margin)) : '—',
            hint: 'Completed quote − cost',
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
          eyebrow="Jobs"
          title="Catering jobs"
          description="Advance each job through confirm → prep → dispatch → complete."
        >
          <DataTable
            columns={columns}
            rows={jobs}
            rowKey={(row) => row.id}
            isLoading={jobsQuery.isLoading}
            isError={jobsQuery.isError}
            pageSize={12}
            emptyTitle="No catering jobs"
            emptyDescription="Create a job to start planning kitchen, staff, and logistics."
          />
        </WorkspacePanel>
      </WorkspacePage>

      <DrawerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New catering job"
        onSubmit={submitCreate}
        isPending={mutations.createCatering.isPending}
        error={error}
        submitLabel="Create job"
      >
        <Field label="Job name" required>
          <input
            className={fieldInputClassName}
            value={field('name')}
            onChange={(event) => setField('name', event.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <select
              className={fieldInputClassName}
              value={field('kind')}
              onChange={(event) => setField('kind', event.target.value)}
            >
              <option value="CORPORATE">Corporate</option>
              <option value="DELIVERY">Delivery</option>
              <option value="OUTSIDE">Outside event</option>
            </select>
          </Field>
          <Field label="Guests">
            <input
              className={fieldInputClassName}
              type="number"
              min={1}
              value={field('guestCount')}
              onChange={(event) => setField('guestCount', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Event date" required>
          <input
            className={fieldInputClassName}
            type="datetime-local"
            value={field('eventDate')}
            onChange={(event) => setField('eventDate', event.target.value)}
            required
          />
        </Field>
        <Field label="Address">
          <input
            className={fieldInputClassName}
            value={field('addressLine')}
            onChange={(event) => setField('addressLine', event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quote">
            <input
              className={fieldInputClassName}
              type="number"
              min={0}
              step="0.01"
              value={field('quoteAmount')}
              onChange={(event) => setField('quoteAmount', event.target.value)}
            />
          </Field>
          <Field label="Estimated cost">
            <input
              className={fieldInputClassName}
              type="number"
              min={0}
              step="0.01"
              value={field('costAmount')}
              onChange={(event) => setField('costAmount', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className={fieldInputClassName + ' h-20 py-2'}
            value={field('notes')}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </Field>
      </DrawerForm>
    </AccessGuard>
  )
}
