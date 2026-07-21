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
import type { DocumentTransition } from '#/components/documents/document-status-flow'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  getErrorMessage,
  notifyError,
  notifySuccess,
} from '#/lib/toast/toast-store'
import { useProductsPage } from '#/features/products/use-products'
import { useUoms } from '#/features/products/use-master-data'
import { useSuppliers } from '#/features/suppliers/use-suppliers'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import {
  useRequisition,
  useRequisitionMutations,
  useRequisitions,
} from '#/features/purchasing/use-requisitions'

const VIEW_PERMISSION = 'purchase.requisition_view'
const MANAGE_PERMISSION = 'purchase.requisition_manage'

const REQUISITION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CONVERTED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
]

type RequisitionRow = NonNullable<
  ReturnType<typeof useRequisitions>['data']
>[number]

function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function formatQty(value: string | number | null | undefined): string {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
}

export function RequisitionWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can([MANAGE_PERMISSION])

  const [status, setStatus] = React.useState('')
  const [warehouseFilter, setWarehouseFilter] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const requisitionsQuery = useRequisitions()
  const warehousesQuery = useWarehouses()

  const requisitions = React.useMemo(
    () => requisitionsQuery.data ?? [],
    [requisitionsQuery.data],
  )
  const warehouses = React.useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  )

  const warehouseNameById = React.useMemo(
    () =>
      new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  )

  const rows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()

    return requisitions.filter((row) => {
      if (status && row.status !== status) {
        return false
      }
      if (warehouseFilter && row.warehouseId !== warehouseFilter) {
        return false
      }
      if (needle && !row.documentNumber.toLowerCase().includes(needle)) {
        return false
      }
      return true
    })
  }, [requisitions, status, warehouseFilter, search])

  const draftCount = requisitions.filter((row) => row.status === 'DRAFT').length
  const awaitingCount = requisitions.filter(
    (row) => row.status === 'SUBMITTED',
  ).length

  const columns: DataTableColumn<RequisitionRow>[] = React.useMemo(
    () => [
      {
        id: 'documentNumber',
        header: 'Requisition',
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
          <StatusChip tone={documentStatusTone(row.status)}>
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
        cell: (row) =>
          row.warehouseId
            ? (warehouseNameById.get(row.warehouseId) ?? 'Unknown')
            : '—',
        sortValue: (row) =>
          row.warehouseId ? (warehouseNameById.get(row.warehouseId) ?? '') : '',
        exportValue: (row) =>
          row.warehouseId ? (warehouseNameById.get(row.warehouseId) ?? '') : '',
      },
      {
        id: 'priority',
        header: 'Priority',
        cell: (row) =>
          row.priority ? formatDocumentStatus(row.priority) : '—',
        sortValue: (row) => row.priority ?? '',
        exportValue: (row) => row.priority ?? '',
        defaultHidden: true,
      },
      {
        id: 'department',
        header: 'Department',
        cell: (row) => row.department ?? '—',
        sortValue: (row) => row.department ?? '',
        exportValue: (row) => row.department ?? '',
        defaultHidden: true,
      },
      {
        id: 'requiredDate',
        header: 'Required',
        cell: (row) => formatDate(row.requiredDate),
        sortValue: (row) =>
          row.requiredDate ? new Date(row.requiredDate).getTime() : 0,
        exportValue: (row) => formatDate(row.requiredDate),
      },
      {
        id: 'createdAt',
        header: 'Raised',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.createdAt)}
          </span>
        ),
        sortValue: (row) => new Date(row.createdAt).getTime(),
        exportValue: (row) => formatDate(row.createdAt),
      },
      {
        id: 'convertedToPoId',
        header: 'Converted',
        cell: (row) =>
          row.convertedToPoId ? (
            <StatusChip tone="success">Yes</StatusChip>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        sortValue: (row) => (row.convertedToPoId ? 1 : 0),
        exportValue: (row) => (row.convertedToPoId ? 'yes' : 'no'),
      },
    ],
    [warehouseNameById],
  )

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Purchase requisitions"
      title="Demand captured before a single order is placed."
      description="Requisitions record what the business needs, route it for approval, and hand an approved basket to purchasing to price with a supplier. Nothing here commits stock or spend."
      metrics={[
        {
          label: 'Requisitions',
          value: requisitionsQuery.isLoading
            ? '—'
            : requisitions.length.toLocaleString(),
          hint: 'Most recent 50',
          tone: 'red',
        },
        {
          label: 'Drafts',
          value: requisitionsQuery.isLoading
            ? '—'
            : draftCount.toLocaleString(),
          hint: 'Not yet submitted',
          tone: 'neutral',
        },
        {
          label: 'Awaiting approval',
          value: requisitionsQuery.isLoading
            ? '—'
            : awaitingCount.toLocaleString(),
          hint: 'Submitted, pending sign-off',
          tone: 'accent',
        },
      ]}
      actions={
        canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            New requisition
          </Button>
        ) : null
      }
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Requisition register"
        description="Filter by status and warehouse, open a row to review its lines, and move it through submit, approve, and convert."
      >
        <AccessGuard
          permissions={[VIEW_PERMISSION]}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to requisitions"
              description="Ask an administrator for the 'View Requisitions' permission to open this register."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={REQUISITION_STATUSES.map((value) => ({
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
              placeholder="Search requisition number…"
            />
          </FilterBar>

          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              isLoading={requisitionsQuery.isLoading}
              isError={requisitionsQuery.isError}
              errorMessage="Could not load requisitions. Check your connection and permissions, then retry."
              emptyTitle="No requisitions found"
              emptyDescription="Raise a requisition to record demand and start the approval trail."
              onRowClick={(row) => setSelectedId(row.id)}
              enableColumnVisibility
              exportFileName="purchase-requisitions"
              pageSize={25}
              stickyHeader
            />
          </div>
        </AccessGuard>
      </WorkspacePanel>

      <RequisitionCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        warehouses={warehouses}
      />

      <RequisitionDetailSheet
        requisitionId={selectedId}
        onClose={() => setSelectedId(null)}
        warehouseNameById={warehouseNameById}
        warehouses={warehouses}
      />
    </WorkspacePage>
  )
}

interface WarehouseOption {
  id: string
  name: string
}

function RequisitionCreateDrawer({
  open,
  onOpenChange,
  warehouses,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouses: WarehouseOption[]
}) {
  const { createRequisition } = useRequisitionMutations()
  const productsQuery = useProductsPage({ take: 200 })
  const uomsQuery = useUoms()

  const [warehouseId, setWarehouseId] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [lines, setLines] = React.useState<DocumentLine[]>(() => [
    createEmptyLine(),
  ])
  const [lineErrors, setLineErrors] = React.useState<
    Record<string, Partial<Record<string, string>>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)

  const productOptions = React.useMemo(
    () =>
      (productsQuery.data?.items ?? []).map((product) => ({
        value: product.id,
        label: `${product.sku} — ${product.name}`,
      })),
    [productsQuery.data],
  )

  const uomOptions = React.useMemo(
    () =>
      (uomsQuery.data ?? []).map((uom) => ({
        value: uom.id,
        label: `${uom.code} — ${uom.name}`,
      })),
    [uomsQuery.data],
  )

  function reset() {
    setWarehouseId('')
    setNotes('')
    setLines([createEmptyLine()])
    setLineErrors({})
    setFormError(null)
  }

  async function handleSubmit() {
    setFormError(null)

    const errors = validateLines(lines, { requiredFields: ['uomId'] })
    setLineErrors(errors)

    if (lines.length === 0) {
      setFormError('Add at least one line before saving this requisition.')
      return
    }

    if (Object.keys(errors).length > 0) {
      setFormError('Fix the highlighted line errors before saving.')
      return
    }

    try {
      await createRequisition.mutateAsync({
        warehouseId: warehouseId || null,
        notes: notes.trim() ? notes.trim() : null,
        lines: lines.map((line) => ({
          productId: line.productId,
          uomId: line.uomId as string,
          quantity: line.quantity,
          notes: line.note?.trim() ? line.note.trim() : null,
        })),
      })

      notifySuccess('Requisition created', 'It is saved as a draft.')
      reset()
      onOpenChange(false)
    } catch (error) {
      setFormError(getErrorMessage(error))
      notifyError(error, 'Could not create requisition')
    }
  }

  return (
    <DrawerForm
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
        }
        onOpenChange(next)
      }}
      title="New requisition"
      description="Record what is needed and where. Pricing and supplier selection happen at conversion."
      onSubmit={handleSubmit}
      submitLabel="Create requisition"
      isPending={createRequisition.isPending}
      error={formError}
      submitDisabled={lines.length === 0}
    >
      <Field
        label="Warehouse"
        hint="Optional — leave blank for a central request."
      >
        <select
          className={fieldInputClassName}
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
        >
          <option value="">No specific warehouse</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Notes"
        hint="Context for the approver — max 2000 characters."
      >
        <textarea
          className="min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Lines</span>
        <LineItemsEditor
          lines={lines}
          onChange={setLines}
          products={productOptions}
          columns={{ unitCost: false, note: true }}
          selects={[
            {
              field: 'uomId',
              label: 'Unit of measure',
              options: uomOptions,
              required: true,
            },
          ]}
          errors={lineErrors}
          disabled={createRequisition.isPending}
          addLabel="Add requisition line"
        />
      </div>
    </DrawerForm>
  )
}

function RequisitionDetailSheet({
  requisitionId,
  onClose,
  warehouseNameById,
  warehouses,
}: {
  requisitionId: string | null
  onClose: () => void
  warehouseNameById: Map<string, string>
  warehouses: WarehouseOption[]
}) {
  const detailQuery = useRequisition(requisitionId)
  const { submitRequisition, approveRequisition, convertRequisition } =
    useRequisitionMutations()
  const suppliersQuery = useSuppliers({ pageSize: 200 })
  const productsQuery = useProductsPage({ take: 200 })

  const productLabelById = React.useMemo(
    () =>
      new Map(
        (productsQuery.data?.items ?? []).map((product) => [
          product.id,
          `${product.sku} — ${product.name}`,
        ]),
      ),
    [productsQuery.data],
  )

  const [convertSupplierId, setConvertSupplierId] = React.useState('')
  const [convertWarehouseId, setConvertWarehouseId] = React.useState('')

  const requisition = detailQuery.data ?? null

  // Reset the conversion draft whenever a different requisition is opened.
  React.useEffect(() => {
    setConvertSupplierId('')
    setConvertWarehouseId(requisition?.warehouseId ?? '')
  }, [requisition?.id, requisition?.warehouseId])

  const suppliers = suppliersQuery.data?.items ?? []

  const isPending =
    submitRequisition.isPending ||
    approveRequisition.isPending ||
    convertRequisition.isPending

  async function runTransition(
    action: () => Promise<unknown>,
    message: string,
  ) {
    try {
      await action()
      notifySuccess(message)
    } catch (error) {
      notifyError(error, 'Requisition action failed')
    }
  }

  const transitions: DocumentTransition[] = !requisition
    ? []
    : [
        {
          id: 'submit',
          label: 'Submit for approval',
          permissions: [MANAGE_PERMISSION],
          disabled: requisition.status !== 'DRAFT',
          onAction: () =>
            runTransition(
              () => submitRequisition.mutateAsync(requisition.id),
              'Requisition submitted',
            ),
        },
        {
          id: 'approve',
          label: 'Approve',
          permissions: [MANAGE_PERMISSION],
          disabled: requisition.status !== 'SUBMITTED',
          confirm: {
            title: 'Approve this requisition?',
            description:
              'Approval releases the requisition to purchasing for conversion. It cannot be edited afterwards.',
            confirmLabel: 'Approve',
          },
          onAction: () =>
            runTransition(
              () => approveRequisition.mutateAsync(requisition.id),
              'Requisition approved',
            ),
        },
        {
          id: 'convert',
          label: 'Convert to purchase order',
          permissions: [MANAGE_PERMISSION],
          disabled:
            requisition.status !== 'APPROVED' ||
            !convertSupplierId ||
            !convertWarehouseId,
          confirm: {
            title: 'Convert to a purchase order?',
            description:
              'A draft purchase order is created with zero unit costs for the buyer to price. The requisition is closed to further changes.',
            confirmLabel: 'Convert',
          },
          onAction: () =>
            runTransition(
              () =>
                convertRequisition.mutateAsync({
                  id: requisition.id,
                  input: {
                    supplierId: convertSupplierId,
                    warehouseId: convertWarehouseId,
                  },
                }),
              'Purchase order created from requisition',
            ),
        },
      ]
        // Only surface steps reachable from the current status.
        .filter((transition) => {
          if (transition.id === 'submit') {
            return requisition.status === 'DRAFT'
          }
          if (transition.id === 'approve') {
            return requisition.status === 'SUBMITTED'
          }
          return requisition.status === 'APPROVED'
        })

  return (
    <Sheet
      open={Boolean(requisitionId)}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {requisition ? requisition.documentNumber : 'Requisition'}
          </SheetTitle>
          <SheetDescription>
            Lines, approval trail, and the lifecycle actions available to you.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          {detailQuery.isError ? (
            <WorkspaceEmptyState
              title="Unable to load requisition"
              description="The requisition could not be fetched. Close this panel and try again."
            />
          ) : null}

          {requisition ? (
            <>
              <DocumentStatusFlow
                status={formatDocumentStatus(requisition.status)}
                tone={documentStatusTone(requisition.status)}
                transitions={transitions}
                isPending={isPending}
              />

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="ops-panel-label">Warehouse</dt>
                  <dd>
                    {requisition.warehouseId
                      ? (warehouseNameById.get(requisition.warehouseId) ??
                        'Unknown')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Raised</dt>
                  <dd>{formatDate(requisition.createdAt)}</dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Required by</dt>
                  <dd>{formatDate(requisition.requiredDate)}</dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Department</dt>
                  <dd>{requisition.department ?? '—'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="ops-panel-label">Notes</dt>
                  <dd className="text-muted-foreground">
                    {requisition.notes ?? '—'}
                  </dd>
                </div>
              </dl>

              {requisition.status === 'APPROVED' ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="ops-panel-label">Conversion target</span>
                  <Field label="Supplier" required>
                    <select
                      className={fieldInputClassName}
                      value={convertSupplierId}
                      onChange={(event) =>
                        setConvertSupplierId(event.target.value)
                      }
                    >
                      <option value="">Select a supplier…</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.code} — {supplier.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Warehouse" required>
                    <select
                      className={fieldInputClassName}
                      value={convertWarehouseId}
                      onChange={(event) =>
                        setConvertWarehouseId(event.target.value)
                      }
                    >
                      <option value="">Select a warehouse…</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}

              <div>
                <span className="ops-panel-label">Lines</span>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Product</th>
                        <th className="px-3 py-2 text-end font-semibold">
                          Quantity
                        </th>
                        <th className="px-3 py-2 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requisition.lines.map((line) => (
                        <tr
                          key={line.id}
                          className="border-b border-border/70 last:border-0"
                        >
                          <td className="px-3 py-2">{line.lineNo}</td>
                          <td className="px-3 py-2 text-xs">
                            {productLabelById.get(line.productId) ??
                              line.productId}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {formatQty(line.quantity)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {line.notes ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
