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
import type { DocumentTransition } from '#/components/documents/document-status-flow'
import {
  DocumentStatusFlow,
  documentStatusTone,
  formatDocumentStatus,
} from '#/components/documents/document-status-flow'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  useTransfer,
  useTransferMutations,
  useTransfers,
} from '#/features/transfers/use-transfers'
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

// TransferStatus mirrors prisma/schema.prisma.
const TRANSFER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'SHIPPED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
] as const

// Legal source states for each leg, per the server state-machine.
const SHIPPABLE_STATUSES = new Set<string>(['DRAFT', 'CONFIRMED'])
const RECEIVABLE_STATUSES = new Set<string>([
  'SHIPPED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
])

const IN_FLIGHT_STATUSES = new Set<string>([
  'SHIPPED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
])

type TransferRow = NonNullable<ReturnType<typeof useTransfers>['data']>[number]
type TransferLineRow = NonNullable<
  ReturnType<typeof useTransfer>['data']
>['lines'][number]

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

export function TransferWorkspace() {
  const { permissions, roles, can } = usePermissions()

  const [status, setStatus] = React.useState('')
  const [warehouseFilter, setWarehouseFilter] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isCreateOpen, setCreateOpen] = React.useState(false)

  // Create-form state.
  const [fromWarehouseId, setFromWarehouseId] = React.useState('')
  const [toWarehouseId, setToWarehouseId] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [lines, setLines] = React.useState<DocumentLine[]>([createEmptyLine()])
  const [lineErrors, setLineErrors] = React.useState<
    Record<string, Partial<Record<string, string>>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)

  const transfersQuery = useTransfers({
    status: status || undefined,
    warehouseId: warehouseFilter || undefined,
    search: search || undefined,
  })
  const detailQuery = useTransfer(selectedId)
  const { createTransfer, shipTransfer, receiveTransfer } =
    useTransferMutations()

  const warehousesQuery = useWarehouses()
  const fromLocationsQuery = useLocations(fromWarehouseId || null)
  const toLocationsQuery = useLocations(toWarehouseId || null)
  const productsQuery = useProductsPage({ take: 200 })
  const uomsQuery = useUoms()

  const rows = transfersQuery.data ?? []
  const warehouses = warehousesQuery.data ?? []
  const canCreate = can(['transfer.create'])

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

  const fromLocationOptions = React.useMemo(
    () =>
      (fromLocationsQuery.data ?? []).map((location) => ({
        value: location.id,
        label: `${location.name} (${location.code})`,
      })),
    [fromLocationsQuery.data],
  )

  const toLocationOptions = React.useMemo(
    () =>
      (toLocationsQuery.data ?? []).map((location) => ({
        value: location.id,
        label: `${location.name} (${location.code})`,
      })),
    [toLocationsQuery.data],
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
    setFromWarehouseId('')
    setToWarehouseId('')
    setNotes('')
    setLines([createEmptyLine()])
    setLineErrors({})
    setFormError(null)
  }

  async function submitCreate() {
    setFormError(null)

    if (!fromWarehouseId || !toWarehouseId) {
      setFormError('Select both the source and destination warehouses.')
      return
    }

    if (fromWarehouseId === toWarehouseId) {
      setFormError('Source and destination warehouses must differ.')
      return
    }

    if (lines.length === 0) {
      setFormError('Add at least one line before saving.')
      return
    }

    const errors = validateLines(lines, {
      requiredFields: ['fromLocationId', 'toLocationId', 'uomId'],
    })
    setLineErrors(errors)

    if (Object.keys(errors).length > 0) {
      setFormError('Fix the highlighted lines before saving.')
      return
    }

    try {
      await createTransfer.mutateAsync({
        fromWarehouseId,
        toWarehouseId,
        notes: notes.trim() ? notes.trim() : null,
        lines: lines.map((line) => ({
          productId: line.productId,
          fromLocationId: line.fromLocationId ?? '',
          toLocationId: line.toLocationId ?? '',
          uomId: line.uomId ?? '',
          requestedQty: Number(line.quantity),
        })),
      })

      notifySuccess('Transfer created', 'The draft is ready to ship.')
      setCreateOpen(false)
      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error))
      notifyError(error, 'Could not create the transfer')
    }
  }

  async function ship(id: string) {
    try {
      await shipTransfer.mutateAsync(id)
      notifySuccess('Transfer shipped', 'Stock has left the source warehouse.')
    } catch (error) {
      notifyError(error, 'Could not ship the transfer')
    }
  }

  async function receive(id: string) {
    try {
      await receiveTransfer.mutateAsync(id)
      notifySuccess(
        'Transfer received',
        'Stock has landed in the destination warehouse.',
      )
    } catch (error) {
      notifyError(error, 'Could not receive the transfer')
    }
  }

  const columns: DataTableColumn<TransferRow>[] = React.useMemo(
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
        id: 'from',
        header: 'From',
        cell: (row) => warehouseName(row.fromWarehouseId),
        sortValue: (row) => warehouseName(row.fromWarehouseId),
        exportValue: (row) => warehouseName(row.fromWarehouseId),
      },
      {
        id: 'to',
        header: 'To',
        cell: (row) => warehouseName(row.toWarehouseId),
        sortValue: (row) => warehouseName(row.toWarehouseId),
        exportValue: (row) => warehouseName(row.toWarehouseId),
      },
      {
        id: 'shipDate',
        header: 'Shipped',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.shipDate)}
          </span>
        ),
        sortValue: (row) =>
          row.shipDate ? new Date(row.shipDate).getTime() : 0,
        exportValue: (row) =>
          row.shipDate ? new Date(row.shipDate).toISOString() : '',
      },
      {
        id: 'receiveDate',
        header: 'Received',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.receiveDate)}
          </span>
        ),
        sortValue: (row) =>
          row.receiveDate ? new Date(row.receiveDate).getTime() : 0,
        exportValue: (row) =>
          row.receiveDate ? new Date(row.receiveDate).toISOString() : '',
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

  const lineColumns: DataTableColumn<TransferLineRow>[] = React.useMemo(
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
        id: 'requestedQty',
        header: 'Requested',
        align: 'end',
        cell: (line) => formatQty(line.requestedQty),
        sortValue: (line) => Number(line.requestedQty),
      },
      {
        id: 'shippedQty',
        header: 'Shipped',
        align: 'end',
        cell: (line) => formatQty(line.shippedQty),
        sortValue: (line) => Number(line.shippedQty),
      },
      {
        id: 'receivedQty',
        header: 'Received',
        align: 'end',
        cell: (line) => formatQty(line.receivedQty),
        sortValue: (line) => Number(line.receivedQty),
      },
    ],
    [productOptions],
  )

  const detail = detailQuery.data

  // Ship then receive — each leg only appears for the statuses the server
  // state-machine actually accepts as a source.
  const transitions: DocumentTransition[] = []

  if (detail) {
    if (SHIPPABLE_STATUSES.has(detail.status)) {
      transitions.push({
        id: 'ship',
        label: 'Ship',
        permissions: ['transfer.ship'],
        confirm: {
          title: 'Ship this transfer?',
          description:
            'Shipping issues every line out of the source warehouse and posts outbound stock movements immediately.',
          confirmLabel: 'Ship transfer',
        },
        onAction: () => ship(detail.id),
      })
    }

    if (RECEIVABLE_STATUSES.has(detail.status)) {
      transitions.push({
        id: 'receive',
        label: 'Receive',
        permissions: ['transfer.receive'],
        confirm: {
          title: 'Receive this transfer?',
          description:
            'Receiving books every shipped line into the destination warehouse and posts inbound stock movements immediately.',
          confirmLabel: 'Receive transfer',
        },
        onAction: () => receive(detail.id),
      })
    }
  }

  const inTransitCount = rows.filter((row) =>
    IN_FLIGHT_STATUSES.has(row.status),
  ).length
  const receivedCount = rows.filter((row) => row.status === 'RECEIVED').length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Warehouse transfers"
      title="Move stock between warehouses without losing sight of it."
      description="A transfer issues stock from the source on ship and books it into the destination on receive. Between those two legs the quantity is in transit — owned, valued, but on neither shelf."
      metrics={[
        {
          label: 'Transfers',
          value: transfersQuery.isLoading ? '—' : rows.length.toLocaleString(),
          hint: 'Matching current filters',
          tone: 'red',
        },
        {
          label: 'In transit',
          value: transfersQuery.isLoading
            ? '—'
            : inTransitCount.toLocaleString(),
          hint: 'Shipped, not yet received',
          tone: 'accent',
        },
        {
          label: 'Received',
          value: transfersQuery.isLoading
            ? '—'
            : receivedCount.toLocaleString(),
          hint: 'Landed at destination',
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
            New transfer
          </Button>
        ) : null
      }
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Transfer documents"
        description="Filter by status and warehouse, open a document to review its lines, and drive it through ship and receive."
      >
        <AccessGuard
          permissions={['transfer.view']}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to warehouse transfers"
              description="Ask an administrator for the 'View Transfers' permission to open this register."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={TRANSFER_STATUSES.map((value) => ({
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
              isLoading={transfersQuery.isLoading}
              isError={transfersQuery.isError}
              errorMessage="Could not load transfers. Check your connection and permissions, then retry."
              emptyTitle="No transfers yet"
              emptyDescription="Create a transfer to move stock between warehouses; the ledger records both legs."
              onRowClick={(row) => setSelectedId(row.id)}
              pageSize={25}
              enableColumnVisibility
              exportFileName="warehouse-transfers"
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
            <SheetTitle>{detail?.documentNumber ?? 'Transfer'}</SheetTitle>
            <SheetDescription>
              {detail
                ? `${warehouseName(detail.fromWarehouseId)} → ${warehouseName(detail.toWarehouseId)}`
                : 'Loading the document…'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
            {detail ? (
              <>
                <DocumentStatusFlow
                  status={formatDocumentStatus(detail.status)}
                  tone={documentStatusTone(detail.status)}
                  isPending={
                    shipTransfer.isPending || receiveTransfer.isPending
                  }
                  transitions={transitions}
                />

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="ops-panel-label">From</dt>
                    <dd className="mt-1">
                      {warehouseName(detail.fromWarehouseId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="ops-panel-label">To</dt>
                    <dd className="mt-1">
                      {warehouseName(detail.toWarehouseId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="ops-panel-label">Shipped</dt>
                    <dd className="mt-1">{formatDate(detail.shipDate)}</dd>
                  </div>
                  <div>
                    <dt className="ops-panel-label">Received</dt>
                    <dd className="mt-1">{formatDate(detail.receiveDate)}</dd>
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
                  emptyDescription="This transfer has no lines."
                />
              </>
            ) : (
              <DataTable
                columns={lineColumns}
                rows={[]}
                rowKey={(line) => line.id}
                isLoading={detailQuery.isLoading}
                isError={detailQuery.isError}
                errorMessage="Could not load this transfer."
                emptyTitle="No lines"
                emptyDescription="This transfer has no lines."
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
        title="New warehouse transfer"
        description="Pick the source and destination, then list what moves. The document is created as a draft — ship and receive it separately."
        submitLabel="Create transfer"
        isPending={createTransfer.isPending}
        error={formError}
        submitDisabled={lines.length === 0}
        onSubmit={submitCreate}
      >
        <Field label="From warehouse" required>
          <select
            className={fieldInputClassName}
            value={fromWarehouseId}
            onChange={(event) => {
              setFromWarehouseId(event.target.value)
              setLines((current) =>
                current.map((line) => ({ ...line, fromLocationId: '' })),
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

        <Field label="To warehouse" required>
          <select
            className={fieldInputClassName}
            value={toWarehouseId}
            onChange={(event) => {
              setToWarehouseId(event.target.value)
              setLines((current) =>
                current.map((line) => ({ ...line, toLocationId: '' })),
              )
            }}
          >
            <option value="">Select a warehouse…</option>
            {warehouses
              .filter((warehouse) => warehouse.id !== fromWarehouseId)
              .map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Notes">
          <input
            className={fieldInputClassName}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context for the receiving team"
          />
        </Field>

        <LineItemsEditor
          lines={lines}
          onChange={setLines}
          products={productOptions}
          errors={lineErrors}
          disabled={createTransfer.isPending}
          columns={{ quantityLabel: 'Requested qty', unitCost: false }}
          selects={[
            {
              field: 'fromLocationId',
              label: 'From location',
              options: fromLocationOptions,
              required: true,
              placeholder: fromWarehouseId
                ? 'Select a location…'
                : 'Pick a source warehouse first…',
            },
            {
              field: 'toLocationId',
              label: 'To location',
              options: toLocationOptions,
              required: true,
              placeholder: toWarehouseId
                ? 'Select a location…'
                : 'Pick a destination warehouse first…',
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
