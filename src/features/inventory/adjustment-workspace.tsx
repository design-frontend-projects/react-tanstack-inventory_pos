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
  LineItemsEditor,
  createEmptyLine,
  validateLines,
} from '#/components/documents/line-items-editor'
import type { DocumentLine } from '#/components/documents/line-items-editor'
import {
  DocumentStatusFlow,
  documentStatusTone,
  formatDocumentStatus,
} from '#/components/documents/document-status-flow'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  useAdjustment,
  useAdjustmentMutations,
  useAdjustments,
} from '#/features/inventory/use-adjustments'
import { adjustmentReasonSchema } from '#/features/inventory/validation'
import {
  useLocations,
  useWarehouses,
} from '#/features/warehouses/use-warehouses'
import { useProductsPage } from '#/features/products/use-products'
import { useUoms } from '#/features/products/use-master-data'
import {
  getErrorMessage,
  notifyError,
  notifySuccess,
} from '#/lib/toast/toast-store'

// AdjustmentStatus mirrors prisma/schema.prisma.
const ADJUSTMENT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'POSTED',
  'REJECTED',
  'CANCELLED',
] as const

// Only these states can legally reach `posted` (see server state-machine).
const POSTABLE_STATUSES = new Set<string>(['DRAFT', 'APPROVED'])

const REASON_CODES = adjustmentReasonSchema.options

type AdjustmentRow = NonNullable<
  ReturnType<typeof useAdjustments>['data']
>[number]
type AdjustmentLineRow = NonNullable<
  ReturnType<typeof useAdjustment>['data']
>['lines'][number]

type Direction = 'INCREASE' | 'DECREASE'

function formatQty(value: string | number | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString()
}

export function AdjustmentWorkspace() {
  const { permissions, roles, can } = usePermissions()

  const [status, setStatus] = React.useState('')
  const [warehouseFilter, setWarehouseFilter] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isCreateOpen, setCreateOpen] = React.useState(false)

  // Create-form state.
  const [warehouseId, setWarehouseId] = React.useState('')
  const [reasonCode, setReasonCode] =
    React.useState<(typeof REASON_CODES)[number]>('CORRECTION')
  const [direction, setDirection] = React.useState<Direction>('DECREASE')
  const [notes, setNotes] = React.useState('')
  const [lines, setLines] = React.useState<DocumentLine[]>([createEmptyLine()])
  const [lineErrors, setLineErrors] = React.useState<
    Record<string, Partial<Record<string, string>>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)

  const adjustmentsQuery = useAdjustments({
    status: status || undefined,
    warehouseId: warehouseFilter || undefined,
    search: search || undefined,
  })
  const detailQuery = useAdjustment(selectedId)
  const { createAdjustment, postAdjustment } = useAdjustmentMutations()

  const warehousesQuery = useWarehouses()
  const locationsQuery = useLocations(warehouseId || null)
  const productsQuery = useProductsPage({ take: 200 })
  const uomsQuery = useUoms()

  const rows = adjustmentsQuery.data ?? []
  const warehouses = warehousesQuery.data ?? []
  const canCreate = can(['adjustment.create'])

  const warehouseName = React.useCallback(
    (id: string) => warehouses.find((item) => item.id === id)?.name ?? id,
    [warehouses],
  )

  const productOptions = React.useMemo(
    () =>
      (productsQuery.data?.items ?? []).map((product) => ({
        value: product.id,
        label: `${product.name} · ${product.sku}`,
      })),
    [productsQuery.data],
  )

  const locationOptions = React.useMemo(
    () =>
      (locationsQuery.data ?? []).map((location) => ({
        value: location.id,
        label: `${location.name} (${location.code})`,
      })),
    [locationsQuery.data],
  )

  const uomOptions = React.useMemo(
    () =>
      (uomsQuery.data ?? []).map((uom) => ({
        value: uom.id,
        label: `${uom.name} (${uom.code})`,
      })),
    [uomsQuery.data],
  )

  function resetForm() {
    setWarehouseId('')
    setReasonCode('CORRECTION')
    setDirection('DECREASE')
    setNotes('')
    setLines([createEmptyLine()])
    setLineErrors({})
    setFormError(null)
  }

  async function submitCreate() {
    setFormError(null)

    if (!warehouseId) {
      setFormError('Select the warehouse this adjustment applies to.')
      return
    }

    if (lines.length === 0) {
      setFormError('Add at least one line before saving.')
      return
    }

    const errors = validateLines(lines, {
      requiredFields: ['locationId', 'uomId'],
    })
    setLineErrors(errors)

    if (Object.keys(errors).length > 0) {
      setFormError('Fix the highlighted lines before saving.')
      return
    }

    // The shared editor's quantity input is unsigned, so the header Direction
    // select supplies the sign. Without a system-qty lookup the delta is also
    // the adjusted qty — the posting engine derives the resulting balance.
    const sign = direction === 'DECREASE' ? -1 : 1

    try {
      await createAdjustment.mutateAsync({
        warehouseId,
        reasonCode,
        notes: notes.trim() ? notes.trim() : null,
        lines: lines.map((line) => {
          const qty = Number(line.quantity) * sign

          return {
            productId: line.productId,
            locationId: line.locationId ?? '',
            uomId: line.uomId ?? '',
            adjustedQty: qty,
            qtyDelta: qty,
            unitCost: line.unitCost ? Number(line.unitCost) : null,
          }
        }),
      })

      notifySuccess(
        'Adjustment created',
        'The draft is ready to review and post.',
      )
      setCreateOpen(false)
      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error))
      notifyError(error, 'Could not create the adjustment')
    }
  }

  async function post(id: string) {
    try {
      await postAdjustment.mutateAsync(id)
      notifySuccess('Adjustment posted', 'Stock movements have been written.')
    } catch (error) {
      notifyError(error, 'Could not post the adjustment')
    }
  }

  const columns: DataTableColumn<AdjustmentRow>[] = React.useMemo(
    () => [
      {
        id: 'documentNumber',
        header: 'Document',
        cell: (row) => (
          <span className="font-mono text-xs font-medium">
            {row.documentNumber}
          </span>
        ),
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
        alwaysVisible: true,
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) => warehouseName(row.warehouseId),
        sortValue: (row) => warehouseName(row.warehouseId),
        exportValue: (row) => warehouseName(row.warehouseId),
      },
      {
        id: 'reasonCode',
        header: 'Reason',
        cell: (row) => (
          <StatusChip tone="neutral">
            {formatDocumentStatus(row.reasonCode)}
          </StatusChip>
        ),
        sortValue: (row) => row.reasonCode,
        exportValue: (row) => row.reasonCode,
      },
      {
        id: 'createdAt',
        header: 'Created',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.createdAt)}
          </span>
        ),
        sortValue: (row) => new Date(row.createdAt).getTime(),
        exportValue: (row) => new Date(row.createdAt).toISOString(),
      },
      {
        id: 'postedAt',
        header: 'Posted',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.postedAt)}
          </span>
        ),
        sortValue: (row) =>
          row.postedAt ? new Date(row.postedAt).getTime() : 0,
        exportValue: (row) =>
          row.postedAt ? new Date(row.postedAt).toISOString() : '',
        defaultHidden: true,
      },
      {
        id: 'notes',
        header: 'Notes',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.notes ?? '—'}
          </span>
        ),
        sortValue: (row) => row.notes ?? '',
        exportValue: (row) => row.notes ?? '',
        defaultHidden: true,
      },
    ],
    [warehouseName],
  )

  const lineColumns: DataTableColumn<AdjustmentLineRow>[] = React.useMemo(
    () => [
      {
        id: 'lineNo',
        header: '#',
        cell: (line) => line.lineNo,
        sortValue: (line) => line.lineNo,
      },
      {
        id: 'product',
        header: 'Product',
        cell: (line) =>
          productOptions.find((option) => option.value === line.productId)
            ?.label ?? line.productId,
      },
      {
        id: 'qtyDelta',
        header: 'Qty Δ',
        align: 'end',
        cell: (line) => {
          const numeric = Number(line.qtyDelta)
          return (
            <span
              className={
                numeric < 0
                  ? 'text-destructive'
                  : 'text-emerald-600 dark:text-emerald-400'
              }
            >
              {numeric > 0 ? '+' : ''}
              {formatQty(line.qtyDelta)}
            </span>
          )
        },
        sortValue: (line) => Number(line.qtyDelta),
      },
      {
        id: 'unitCost',
        header: 'Unit cost',
        align: 'end',
        cell: (line) => formatQty(line.unitCost),
      },
    ],
    [productOptions],
  )

  const detail = detailQuery.data
  const postedCount = rows.filter((row) => row.isPosted).length
  const draftCount = rows.filter((row) => row.status === 'DRAFT').length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Stock adjustments"
      title="Reconcile what the system believes with what the shelf holds."
      description="Damage, expiry, shrinkage and found stock are captured as adjustment documents. Nothing touches the ledger until a document is posted — and posting is irreversible."
      metrics={[
        {
          label: 'Adjustments',
          value: adjustmentsQuery.isLoading
            ? '—'
            : rows.length.toLocaleString(),
          hint: 'Matching current filters',
          tone: 'red',
        },
        {
          label: 'Drafts',
          value: adjustmentsQuery.isLoading ? '—' : draftCount.toLocaleString(),
          hint: 'Awaiting posting',
          tone: 'accent',
        },
        {
          label: 'Posted',
          value: adjustmentsQuery.isLoading
            ? '—'
            : postedCount.toLocaleString(),
          hint: 'Written to the ledger',
          tone: 'neutral',
        },
      ]}
      actions={
        canCreate ? (
          <Button
            type="button"
            onClick={() => {
              resetForm()
              setCreateOpen(true)
            }}
          >
            New adjustment
          </Button>
        ) : null
      }
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Adjustment documents"
        description="Filter by status and warehouse, open a document to review its lines, and post it when the count is confirmed."
      >
        <AccessGuard
          permissions={['adjustment.view']}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to stock adjustments"
              description="Ask an administrator for the 'View Adjustments' permission to open this register."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={ADJUSTMENT_STATUSES.map((value) => ({
                value,
                label: formatDocumentStatus(value),
              }))}
            />
            <FilterSelect
              label="Warehouse"
              value={warehouseFilter}
              onChange={setWarehouseFilter}
              allLabel="All warehouses"
              options={warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              }))}
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
              isLoading={adjustmentsQuery.isLoading}
              isError={adjustmentsQuery.isError}
              errorMessage="Could not load adjustments. Check your connection and permissions, then retry."
              emptyTitle="No adjustments yet"
              emptyDescription="Create an adjustment when a physical count, damage report, or write-off needs to reach the ledger."
              onRowClick={(row) => setSelectedId(row.id)}
              pageSize={25}
              enableColumnVisibility
              exportFileName="stock-adjustments"
              stickyHeader
            />
          </div>
        </AccessGuard>
      </WorkspacePanel>

      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{detail?.documentNumber ?? 'Adjustment'}</SheetTitle>
            <SheetDescription>
              {detail
                ? `${formatDocumentStatus(detail.reasonCode)} · ${warehouseName(detail.warehouseId)}`
                : 'Loading the document…'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
            {detail ? (
              <>
                <DocumentStatusFlow
                  status={formatDocumentStatus(detail.status)}
                  tone={documentStatusTone(detail.status)}
                  isPending={postAdjustment.isPending}
                  transitions={
                    POSTABLE_STATUSES.has(detail.status)
                      ? [
                          {
                            id: 'post',
                            label: 'Post',
                            permissions: ['adjustment.post'],
                            variant: 'destructive',
                            confirm: {
                              title: 'Post this adjustment?',
                              description:
                                'Posting writes stock movements immediately and cannot be undone. On-hand quantities and valuation will change for every line on this document.',
                              confirmLabel: 'Post adjustment',
                              tone: 'destructive',
                            },
                            onAction: () => post(detail.id),
                          },
                        ]
                      : []
                  }
                />

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="ops-panel-label">Warehouse</dt>
                    <dd className="mt-1">
                      {warehouseName(detail.warehouseId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="ops-panel-label">Reason</dt>
                    <dd className="mt-1">
                      {formatDocumentStatus(detail.reasonCode)}
                    </dd>
                  </div>
                  <div>
                    <dt className="ops-panel-label">Created</dt>
                    <dd className="mt-1">{formatDate(detail.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="ops-panel-label">Posted</dt>
                    <dd className="mt-1">{formatDate(detail.postedAt)}</dd>
                  </div>
                  {detail.notes ? (
                    <div className="col-span-2">
                      <dt className="ops-panel-label">Notes</dt>
                      <dd className="mt-1 leading-6 text-muted-foreground">
                        {detail.notes}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <DataTable
                  columns={lineColumns}
                  rows={detail.lines}
                  rowKey={(line) => line.id}
                  emptyTitle="No lines"
                  emptyDescription="This adjustment has no lines."
                />
              </>
            ) : (
              <DataTable
                columns={lineColumns}
                rows={[]}
                rowKey={(line) => line.id}
                isLoading={detailQuery.isLoading}
                isError={detailQuery.isError}
                errorMessage="Could not load this adjustment."
                emptyTitle="No lines"
                emptyDescription="This adjustment has no lines."
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DrawerForm
        open={isCreateOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            resetForm()
          }
        }}
        title="New stock adjustment"
        description="Capture the warehouse, the reason, and the quantity change per product. The document is created as a draft — post it separately."
        submitLabel="Create adjustment"
        isPending={createAdjustment.isPending}
        error={formError}
        submitDisabled={lines.length === 0}
        onSubmit={submitCreate}
      >
        <Field label="Warehouse" required>
          <select
            className={fieldInputClassName}
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value)
              // Locations belong to a warehouse — clear stale picks.
              setLines((current) =>
                current.map((line) => ({ ...line, locationId: '' })),
              )
            }}
          >
            <option value="">Select a warehouse…</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reason code" required>
          <select
            className={fieldInputClassName}
            value={reasonCode}
            onChange={(event) =>
              setReasonCode(event.target.value as (typeof REASON_CODES)[number])
            }
          >
            {REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {formatDocumentStatus(code)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Direction"
          required
          hint="Applies to every line: increase adds stock, decrease removes it."
        >
          <select
            className={fieldInputClassName}
            value={direction}
            onChange={(event) => setDirection(event.target.value as Direction)}
          >
            <option value="DECREASE">Decrease (remove stock)</option>
            <option value="INCREASE">Increase (add stock)</option>
          </select>
        </Field>

        <Field label="Notes">
          <input
            className={fieldInputClassName}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context for the approver"
          />
        </Field>

        <LineItemsEditor
          lines={lines}
          onChange={setLines}
          products={productOptions}
          errors={lineErrors}
          disabled={createAdjustment.isPending}
          columns={{ quantityLabel: 'Quantity delta', unitCost: true }}
          selects={[
            {
              field: 'locationId',
              label: 'Location',
              options: locationOptions,
              required: true,
              placeholder: warehouseId
                ? 'Select a location…'
                : 'Pick a warehouse first…',
            },
            {
              field: 'uomId',
              label: 'Unit of measure',
              options: uomOptions,
              required: true,
            },
          ]}
        />
      </DrawerForm>
    </WorkspacePage>
  )
}
