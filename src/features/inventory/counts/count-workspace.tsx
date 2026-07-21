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
  FilterBar,
  FilterSearch,
  FilterSelect,
} from '#/components/data/filter-bar'
import { StatusChip } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import {
  DocumentStatusFlow,
  documentStatusTone,
  formatDocumentStatus,
} from '#/components/documents/document-status-flow'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import {
  useStockCount,
  useStockCounts,
  useStockCountMutations,
} from '#/features/inventory/counts/use-stock-counts'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['inventory.count_view']
const MANAGE = ['inventory.count_manage']
const APPROVE = ['inventory.count_approve']

type CountSessionRow = NonNullable<
  ReturnType<typeof useStockCounts>['data']
>[number]

function formatQty(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return '—'
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : value
}

// The count-entry grid keeps its own draft of counted quantities so the user can
// work down the whole session before saving once.
function CountEntryGrid({
  sessionId,
  lines,
  editable,
}: {
  sessionId: string
  lines: Array<{
    id: string
    productId: string
    systemQty: string
    countedQty: string | null
    variance: string | null
  }>
  editable: boolean
}) {
  const { recordCounts } = useStockCountMutations()
  const [draft, setDraft] = React.useState<Record<string, string | undefined>>(
    {},
  )

  // Reset the draft whenever a different session (or refreshed data) loads.
  React.useEffect(() => {
    setDraft({})
  }, [sessionId])

  const entries = Object.entries(draft).flatMap(([lineId, value]) =>
    value !== undefined && value.trim() !== '' && Number.isFinite(Number(value))
      ? [{ lineId, countedQty: value }]
      : [],
  )

  async function save() {
    try {
      await recordCounts.mutateAsync({ id: sessionId, entries })
      setDraft({})
      notifySuccess(
        'Counted quantities saved',
        `${entries.length} line(s) updated.`,
      )
    } catch (error) {
      notifyError(error, 'Could not save counted quantities')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 font-semibold">Product</th>
              <th className="px-2 py-2 text-end font-semibold">System</th>
              <th className="px-2 py-2 text-end font-semibold">Counted</th>
              <th className="px-2 py-2 text-end font-semibold">Variance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const counted = draft[line.id] ?? line.countedQty ?? ''
              const variance =
                counted === '' ? null : Number(counted) - Number(line.systemQty)

              return (
                <tr
                  key={line.id}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-2 py-2 font-mono text-xs">
                    {line.productId}
                  </td>
                  <td className="px-2 py-2 text-end tabular-nums">
                    {formatQty(line.systemQty)}
                  </td>
                  <td className="px-2 py-2 text-end">
                    {editable ? (
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        aria-label="Counted quantity"
                        className={`${fieldInputClassName} max-w-28 text-end`}
                        value={counted}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [line.id]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <span className="tabular-nums">
                        {formatQty(line.countedQty)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-end tabular-nums">
                    {variance === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={
                          variance === 0
                            ? 'text-muted-foreground'
                            : variance > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-destructive'
                        }
                      >
                        {variance > 0 ? '+' : ''}
                        {variance.toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editable ? (
        <Button
          type="button"
          size="sm"
          className="w-fit"
          disabled={entries.length === 0 || recordCounts.isPending}
          onClick={() => void save()}
        >
          {recordCounts.isPending
            ? 'Saving…'
            : `Save ${entries.length} counted line(s)`}
        </Button>
      ) : null}
    </div>
  )
}

export function CountWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const [status, setStatus] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [formWarehouseId, setFormWarehouseId] = React.useState('')
  const [formNotes, setFormNotes] = React.useState('')
  const [formCycle, setFormCycle] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const warehousesQuery = useWarehouses()
  const countsQuery = useStockCounts()
  const detailQuery = useStockCount(selectedId)
  const {
    createStockCount,
    startStockCount,
    reviewStockCount,
    approveStockCount,
    cancelStockCount,
  } = useStockCountMutations()

  const sessions = countsQuery.data ?? []
  const warehouseName = (id: string) =>
    (warehousesQuery.data ?? []).find((warehouse) => warehouse.id === id)
      ?.name ?? '—'

  // The list server fn returns the most recent sessions unfiltered, so status
  // and search narrow that page client-side.
  const rows = sessions.filter((session) => {
    if (status && session.status !== status) {
      return false
    }
    if (
      search &&
      !session.documentNumber.toLowerCase().includes(search.toLowerCase())
    ) {
      return false
    }
    return true
  })

  const columns: DataTableColumn<CountSessionRow>[] = [
    {
      id: 'documentNumber',
      header: 'Document',
      cell: (row) => <span className="font-medium">{row.documentNumber}</span>,
      sortValue: (row) => row.documentNumber,
      exportValue: (row) => row.documentNumber,
      alwaysVisible: true,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={documentStatusTone(row.status)} dot>
          {formatDocumentStatus(row.status)}
        </StatusChip>
      ),
      sortValue: (row) => row.status,
      exportValue: (row) => row.status,
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      cell: (row) => warehouseName(row.warehouseId),
      sortValue: (row) => warehouseName(row.warehouseId),
      exportValue: (row) => warehouseName(row.warehouseId),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (row.isCycleCount ? 'Cycle count' : 'Full count'),
      sortValue: (row) => (row.isCycleCount ? 'cycle' : 'full'),
      exportValue: (row) => (row.isCycleCount ? 'cycle' : 'full'),
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
      sortValue: (row) => new Date(row.createdAt).getTime(),
      exportValue: (row) => new Date(row.createdAt).toISOString(),
    },
  ]

  function resetForm() {
    setFormWarehouseId('')
    setFormNotes('')
    setFormCycle(false)
    setFormError(null)
  }

  async function submitCreate() {
    if (!formWarehouseId) {
      setFormError('Select the warehouse to count.')
      return
    }

    setFormError(null)

    try {
      const created = await createStockCount.mutateAsync({
        warehouseId: formWarehouseId,
        isCycleCount: formCycle,
        notes: formNotes || null,
      })
      notifySuccess(
        'Count session created',
        `${created.documentNumber} snapshotted ${created.lines.length} line(s).`,
      )
      setCreateOpen(false)
      resetForm()
      setSelectedId(created.id)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not create the count session.',
      )
      notifyError(error, 'Could not create the count session')
    }
  }

  const detail = detailQuery.data
  const mutating =
    startStockCount.isPending ||
    reviewStockCount.isPending ||
    approveStockCount.isPending ||
    cancelStockCount.isPending

  async function runTransition(
    action: (id: string) => Promise<unknown>,
    successTitle: string,
    errorTitle: string,
  ) {
    if (!detail) {
      return
    }
    try {
      await action(detail.id)
      notifySuccess(successTitle, detail.documentNumber)
    } catch (error) {
      notifyError(error, errorTitle)
    }
  }

  const transitions = detail
    ? [
        ...(detail.status === 'DRAFT'
          ? [
              {
                id: 'start',
                label: 'Start counting',
                permissions: MANAGE,
                onAction: () =>
                  runTransition(
                    (id) => startStockCount.mutateAsync(id),
                    'Counting started',
                    'Could not start counting',
                  ),
              },
            ]
          : []),
        ...(detail.status === 'COUNTING'
          ? [
              {
                id: 'review',
                label: 'Send to review',
                permissions: MANAGE,
                onAction: () =>
                  runTransition(
                    (id) => reviewStockCount.mutateAsync(id),
                    'Sent to variance review',
                    'Could not send to review',
                  ),
              },
            ]
          : []),
        ...(detail.status === 'REVIEW'
          ? [
              {
                id: 'approve',
                label: 'Approve & post variance',
                permissions: APPROVE,
                variant: 'default' as const,
                confirm: {
                  title: 'Post the counted variance?',
                  description:
                    'This creates and posts a correction adjustment. Stock movements are written to the ledger and cannot be undone.',
                  confirmLabel: 'Post variance',
                  tone: 'destructive' as const,
                },
                onAction: () =>
                  runTransition(
                    (id) => approveStockCount.mutateAsync(id),
                    'Variance posted',
                    'Could not post the variance',
                  ),
              },
            ]
          : []),
        ...(detail.status !== 'POSTED' && detail.status !== 'CANCELLED'
          ? [
              {
                id: 'cancel',
                label: 'Cancel',
                permissions: MANAGE,
                variant: 'outline' as const,
                confirm: {
                  title: 'Cancel this count session?',
                  description:
                    'Counted quantities are kept for audit, but the session can no longer be posted.',
                  confirmLabel: 'Cancel session',
                  tone: 'destructive' as const,
                },
                onAction: () =>
                  runTransition(
                    (id) => cancelStockCount.mutateAsync(id),
                    'Count session cancelled',
                    'Could not cancel the session',
                  ),
              },
            ]
          : []),
      ]
    : []

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Stock counts"
      title="Count what is really on the shelf, then post the difference once."
      description="A session snapshots system quantities, collects counted quantities, and on approval hands the variance to the adjustment engine — so counts and manual adjustments share one audited path into the ledger."
      actions={
        can(MANAGE) ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            New count session
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Sessions',
          value: countsQuery.isLoading ? '—' : sessions.length.toLocaleString(),
          hint: 'Most recent 50',
          tone: 'red',
        },
        {
          label: 'In progress',
          value: countsQuery.isLoading
            ? '—'
            : sessions
                .filter((s) => s.status === 'COUNTING' || s.status === 'REVIEW')
                .length.toLocaleString(),
          hint: 'Counting or under review',
          tone: 'accent',
        },
        {
          label: 'Posted',
          value: countsQuery.isLoading
            ? '—'
            : sessions
                .filter((s) => s.status === 'POSTED')
                .length.toLocaleString(),
          hint: 'Variance written to the ledger',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Count sessions"
        description="Open a session to record counted quantities, review variances, and post the correction."
      >
        <AccessGuard
          permissions={VIEW}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to stock counts"
              description="Ask an administrator for the 'View Stock Counts' permission."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'COUNTING', label: 'Counting' },
                { value: 'REVIEW', label: 'Review' },
                { value: 'POSTED', label: 'Posted' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              includeAll={false}
            />
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search document number…"
            />
          </FilterBar>

          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              isLoading={countsQuery.isLoading}
              isError={countsQuery.isError}
              errorMessage="Could not load stock count sessions. Check your connection and permissions, then retry."
              emptyTitle="No count sessions yet"
              emptyDescription="Create a session to snapshot system quantities for a warehouse and start counting."
              onRowClick={(row) => setSelectedId(row.id)}
              enableColumnVisibility
              exportFileName="stock-counts"
              pageSize={20}
            />
          </div>
        </AccessGuard>
      </WorkspacePanel>

      <DrawerForm
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            resetForm()
          }
        }}
        title="New count session"
        description="Lines are generated from the current stock balances of the selected warehouse."
        submitLabel="Create session"
        isPending={createStockCount.isPending}
        error={formError}
        submitDisabled={!formWarehouseId}
        onSubmit={submitCreate}
      >
        <Field label="Warehouse" required>
          <select
            className={fieldInputClassName}
            value={formWarehouseId}
            onChange={(event) => setFormWarehouseId(event.target.value)}
          >
            <option value="">Select a warehouse…</option>
            {(warehousesQuery.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Cycle count"
          hint="Cycle counts are partial, recurring counts rather than a full stock take."
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={formCycle}
              onChange={(event) => setFormCycle(event.target.checked)}
            />
            Mark this session as a cycle count
          </label>
        </Field>

        <Field label="Notes">
          <textarea
            className={`${fieldInputClassName} h-20 py-2`}
            value={formNotes}
            onChange={(event) => setFormNotes(event.target.value)}
            placeholder="Why is this count happening?"
          />
        </Field>
      </DrawerForm>

      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{detail?.documentNumber ?? 'Count session'}</SheetTitle>
            <SheetDescription>
              {detail
                ? `${warehouseName(detail.warehouseId)} · ${detail.lines.length} line(s)`
                : 'Loading session…'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
            {detailQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading session…</p>
            ) : detailQuery.isError ? (
              <WorkspaceEmptyState
                title="Could not load this session"
                description="Check your connection and permissions, then retry."
              />
            ) : detail ? (
              <>
                <DocumentStatusFlow
                  status={formatDocumentStatus(detail.status)}
                  tone={documentStatusTone(detail.status)}
                  transitions={transitions}
                  isPending={mutating}
                />

                {detail.notes ? (
                  <p className="text-sm text-muted-foreground">
                    {detail.notes}
                  </p>
                ) : null}

                <CountEntryGrid
                  sessionId={detail.id}
                  lines={detail.lines}
                  editable={
                    can(MANAGE) &&
                    (detail.status === 'COUNTING' || detail.status === 'REVIEW')
                  }
                />
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </WorkspacePage>
  )
}
