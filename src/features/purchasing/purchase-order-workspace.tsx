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
  usePurchaseOrder,
  usePurchaseOrderMutations,
  usePurchaseOrders,
} from '#/features/purchasing/use-purchase-orders'

const VIEW_PERMISSION = 'purchase.po_view'
const CREATE_PERMISSION = 'purchase.po_create'
const APPROVE_PERMISSION = 'purchase.po_approve'

const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'CONFIRMED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
  'REJECTED',
]

type PurchaseOrderRow = NonNullable<
  ReturnType<typeof usePurchaseOrders>['data']
>[number]

function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function formatMoney(value: string | number | null | undefined): string {
  const numeric = Number(value)
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}

function formatQty(value: string | number | null | undefined): string {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
}

export function PurchaseOrderWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canCreate = can([CREATE_PERMISSION])

  const [status, setStatus] = React.useState('')
  const [supplierFilter, setSupplierFilter] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  const ordersQuery = usePurchaseOrders()
  const suppliersQuery = useSuppliers({ pageSize: 200 })
  const warehousesQuery = useWarehouses()

  const orders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])
  const suppliers = React.useMemo(
    () => suppliersQuery.data?.items ?? [],
    [suppliersQuery.data],
  )
  const warehouses = React.useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  )

  const supplierNameById = React.useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  )
  const warehouseNameById = React.useMemo(
    () =>
      new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  )

  const rows = React.useMemo(() => {
    const needle = search.trim().toLowerCase()

    return orders.filter((row) => {
      if (status && row.status !== status) {
        return false
      }
      if (supplierFilter && row.supplierId !== supplierFilter) {
        return false
      }
      if (needle && !row.documentNumber.toLowerCase().includes(needle)) {
        return false
      }
      return true
    })
  }, [orders, status, supplierFilter, search])

  const awaitingAction = orders.filter(
    (row) => row.status === 'DRAFT' || row.status === 'PENDING_APPROVAL',
  ).length
  const committedValue = orders
    .filter((row) => row.status !== 'CANCELLED' && row.status !== 'REJECTED')
    .reduce((total, row) => total + Number(row.grandTotal), 0)

  const columns: DataTableColumn<PurchaseOrderRow>[] = React.useMemo(
    () => [
      {
        id: 'documentNumber',
        header: 'Order',
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
        id: 'supplier',
        header: 'Supplier',
        cell: (row) => supplierNameById.get(row.supplierId) ?? 'Unknown',
        sortValue: (row) => supplierNameById.get(row.supplierId) ?? '',
        exportValue: (row) => supplierNameById.get(row.supplierId) ?? '',
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) => warehouseNameById.get(row.warehouseId) ?? 'Unknown',
        sortValue: (row) => warehouseNameById.get(row.warehouseId) ?? '',
        exportValue: (row) => warehouseNameById.get(row.warehouseId) ?? '',
        defaultHidden: true,
      },
      {
        id: 'orderDate',
        header: 'Ordered',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.orderDate)}
          </span>
        ),
        sortValue: (row) => new Date(row.orderDate).getTime(),
        exportValue: (row) => formatDate(row.orderDate),
      },
      {
        id: 'expectedDate',
        header: 'Expected',
        cell: (row) => formatDate(row.expectedDate),
        sortValue: (row) =>
          row.expectedDate ? new Date(row.expectedDate).getTime() : 0,
        exportValue: (row) => formatDate(row.expectedDate),
      },
      {
        id: 'subtotal',
        header: 'Subtotal',
        align: 'end',
        cell: (row) => formatMoney(row.subtotal),
        sortValue: (row) => Number(row.subtotal),
        exportValue: (row) => row.subtotal,
        defaultHidden: true,
      },
      {
        id: 'grandTotal',
        header: 'Total',
        align: 'end',
        cell: (row) => (
          <span className="font-medium">
            {formatMoney(row.grandTotal)} {row.currencyCode}
          </span>
        ),
        sortValue: (row) => Number(row.grandTotal),
        exportValue: (row) => row.grandTotal,
        alwaysVisible: true,
      },
    ],
    [supplierNameById, warehouseNameById],
  )

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Purchase orders"
      title="The commitment you make to a supplier, before any stock moves."
      description="A purchase order prices an approved basket and records intent. Inventory only changes when a goods receipt is posted against the confirmed order."
      metrics={[
        {
          label: 'Purchase orders',
          value: ordersQuery.isLoading ? '—' : orders.length.toLocaleString(),
          hint: 'Most recent 50',
          tone: 'red',
        },
        {
          label: 'Awaiting action',
          value: ordersQuery.isLoading ? '—' : awaitingAction.toLocaleString(),
          hint: 'Draft or pending approval',
          tone: 'accent',
        },
        {
          label: 'Committed value',
          value: ordersQuery.isLoading ? '—' : formatMoney(committedValue),
          hint: 'Excludes cancelled and rejected',
          tone: 'neutral',
        },
      ]}
      actions={
        canCreate ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            New purchase order
          </Button>
        ) : null
      }
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Purchase order register"
        description="Filter by status and supplier, open a row to review its priced lines, and move it through approval, confirmation, or cancellation."
      >
        <AccessGuard
          permissions={[VIEW_PERMISSION]}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to purchase orders"
              description="Ask an administrator for the 'View Purchase Orders' permission to open this register."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={PURCHASE_ORDER_STATUSES.map((value) => ({
                value,
                label: formatDocumentStatus(value),
              }))}
            />
            <FilterSelect
              label="Supplier"
              value={supplierFilter}
              onChange={setSupplierFilter}
              allLabel="All suppliers"
              options={suppliers.map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              }))}
            />
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search order number…"
            />
          </FilterBar>

          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              isLoading={ordersQuery.isLoading}
              isError={ordersQuery.isError}
              errorMessage="Could not load purchase orders. Check your connection and permissions, then retry."
              emptyTitle="No purchase orders found"
              emptyDescription="Raise an order directly, or convert an approved requisition into a draft order."
              onRowClick={(row) => setSelectedId(row.id)}
              enableColumnVisibility
              exportFileName="purchase-orders"
              pageSize={25}
              stickyHeader
            />
          </div>
        </AccessGuard>
      </WorkspacePanel>

      <PurchaseOrderCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        suppliers={suppliers}
        warehouses={warehouses}
      />

      <PurchaseOrderDetailSheet
        purchaseOrderId={selectedId}
        onClose={() => setSelectedId(null)}
        supplierNameById={supplierNameById}
        warehouseNameById={warehouseNameById}
      />
    </WorkspacePage>
  )
}

interface SupplierOption {
  id: string
  code: string
  name: string
}

interface WarehouseOption {
  id: string
  name: string
}

function PurchaseOrderCreateDrawer({
  open,
  onOpenChange,
  suppliers,
  warehouses,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: SupplierOption[]
  warehouses: WarehouseOption[]
}) {
  const { createPurchaseOrder } = usePurchaseOrderMutations()
  const productsQuery = useProductsPage({ take: 200 })
  const uomsQuery = useUoms()

  const [supplierId, setSupplierId] = React.useState('')
  const [warehouseId, setWarehouseId] = React.useState('')
  const [expectedDate, setExpectedDate] = React.useState('')
  const [currencyCode, setCurrencyCode] = React.useState('')
  const [paymentTerms, setPaymentTerms] = React.useState('')
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

  const draftTotal = lines.reduce((total, line) => {
    const quantity = Number(line.quantity)
    const unitCost = Number(line.unitCost)
    if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
      return total
    }
    return total + quantity * unitCost
  }, 0)

  function reset() {
    setSupplierId('')
    setWarehouseId('')
    setExpectedDate('')
    setCurrencyCode('')
    setPaymentTerms('')
    setNotes('')
    setLines([createEmptyLine()])
    setLineErrors({})
    setFormError(null)
  }

  async function handleSubmit() {
    setFormError(null)

    if (!supplierId || !warehouseId) {
      setFormError('Select both a supplier and a receiving warehouse.')
      return
    }

    const errors = validateLines(lines, {
      requireUnitCost: true,
      requiredFields: ['uomId'],
    })
    setLineErrors(errors)

    if (lines.length === 0) {
      setFormError('Add at least one line before saving this order.')
      return
    }

    if (Object.keys(errors).length > 0) {
      setFormError('Fix the highlighted line errors before saving.')
      return
    }

    const trimmedCurrency = currencyCode.trim().toUpperCase()

    if (trimmedCurrency && trimmedCurrency.length !== 3) {
      setFormError('Currency must be a 3-letter ISO code, e.g. USD.')
      return
    }

    try {
      await createPurchaseOrder.mutateAsync({
        supplierId,
        warehouseId,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        currencyCode: trimmedCurrency ? trimmedCurrency : undefined,
        paymentTerms: paymentTerms.trim() ? paymentTerms.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        lines: lines.map((line) => ({
          productId: line.productId,
          uomId: line.uomId as string,
          orderedQty: line.quantity,
          unitCost: line.unitCost as string,
        })),
      })

      notifySuccess('Purchase order created', 'It is saved as a draft.')
      reset()
      onOpenChange(false)
    } catch (error) {
      setFormError(getErrorMessage(error))
      notifyError(error, 'Could not create purchase order')
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
      title="New purchase order"
      description="Price the basket and commit it to a supplier. Stock only moves when the goods receipt is posted."
      onSubmit={handleSubmit}
      submitLabel="Create order"
      isPending={createPurchaseOrder.isPending}
      error={formError}
      submitDisabled={lines.length === 0 || !supplierId || !warehouseId}
    >
      <Field label="Supplier" required>
        <select
          className={fieldInputClassName}
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
        >
          <option value="">Select a supplier…</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.code} — {supplier.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Receiving warehouse" required>
        <select
          className={fieldInputClassName}
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
        >
          <option value="">Select a warehouse…</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Expected date"
        hint="Optional delivery target for the order."
      >
        <input
          className={fieldInputClassName}
          type="date"
          value={expectedDate}
          onChange={(event) => setExpectedDate(event.target.value)}
        />
      </Field>

      <Field
        label="Currency"
        hint="Leave blank to use the tenant default (USD)."
      >
        <input
          className={fieldInputClassName}
          value={currencyCode}
          maxLength={3}
          placeholder="USD"
          onChange={(event) => setCurrencyCode(event.target.value)}
        />
      </Field>

      <Field label="Payment terms" hint="Optional — e.g. Net 30.">
        <input
          className={fieldInputClassName}
          value={paymentTerms}
          maxLength={120}
          onChange={(event) => setPaymentTerms(event.target.value)}
        />
      </Field>

      <Field label="Notes">
        <textarea
          className="min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Lines</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            Draft total {formatMoney(draftTotal)}
          </span>
        </div>
        <LineItemsEditor
          lines={lines}
          onChange={setLines}
          products={productOptions}
          columns={{ quantityLabel: 'Ordered qty' }}
          selects={[
            {
              field: 'uomId',
              label: 'Unit of measure',
              options: uomOptions,
              required: true,
            },
          ]}
          errors={lineErrors}
          disabled={createPurchaseOrder.isPending}
          addLabel="Add order line"
        />
      </div>
    </DrawerForm>
  )
}

function PurchaseOrderDetailSheet({
  purchaseOrderId,
  onClose,
  supplierNameById,
  warehouseNameById,
}: {
  purchaseOrderId: string | null
  onClose: () => void
  supplierNameById: Map<string, string>
  warehouseNameById: Map<string, string>
}) {
  const detailQuery = usePurchaseOrder(purchaseOrderId)
  const productsQuery = useProductsPage({ take: 200 })
  const { approvePurchaseOrder, confirmPurchaseOrder, cancelPurchaseOrder } =
    usePurchaseOrderMutations()

  const order = detailQuery.data ?? null

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

  const isPending =
    approvePurchaseOrder.isPending ||
    confirmPurchaseOrder.isPending ||
    cancelPurchaseOrder.isPending

  async function runTransition(
    action: () => Promise<unknown>,
    message: string,
  ) {
    try {
      await action()
      notifySuccess(message)
    } catch (error) {
      notifyError(error, 'Purchase order action failed')
    }
  }

  const canApprove =
    order?.status === 'DRAFT' || order?.status === 'PENDING_APPROVAL'
  const canConfirm = order?.status === 'APPROVED'
  const canCancel =
    order !== null &&
    ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONFIRMED'].includes(
      order.status,
    )

  const transitions: DocumentTransition[] = !order
    ? []
    : [
        ...(canApprove
          ? [
              {
                id: 'approve',
                label: 'Approve',
                permissions: [APPROVE_PERMISSION],
                confirm: {
                  title: 'Approve this purchase order?',
                  description:
                    'Approval clears the order for confirmation with the supplier. The lines can no longer be repriced here.',
                  confirmLabel: 'Approve',
                },
                onAction: () =>
                  runTransition(
                    () => approvePurchaseOrder.mutateAsync(order.id),
                    'Purchase order approved',
                  ),
              } satisfies DocumentTransition,
            ]
          : []),
        ...(canConfirm
          ? [
              {
                id: 'confirm',
                label: 'Confirm with supplier',
                permissions: [APPROVE_PERMISSION],
                onAction: () =>
                  runTransition(
                    () => confirmPurchaseOrder.mutateAsync(order.id),
                    'Purchase order confirmed',
                  ),
              } satisfies DocumentTransition,
            ]
          : []),
        ...(canCancel
          ? [
              {
                id: 'cancel',
                label: 'Cancel order',
                permissions: [APPROVE_PERMISSION],
                variant: 'destructive' as const,
                confirm: {
                  title: 'Cancel this purchase order?',
                  description:
                    'Cancellation is final. The order can no longer be received against and must be raised again if still needed.',
                  confirmLabel: 'Cancel order',
                  tone: 'destructive' as const,
                },
                onAction: () =>
                  runTransition(
                    () => cancelPurchaseOrder.mutateAsync(order.id),
                    'Purchase order cancelled',
                  ),
              } satisfies DocumentTransition,
            ]
          : []),
      ]

  return (
    <Sheet
      open={Boolean(purchaseOrderId)}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {order ? order.documentNumber : 'Purchase order'}
          </SheetTitle>
          <SheetDescription>
            Priced lines, receipt progress, and the lifecycle actions available
            to you.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          {detailQuery.isError ? (
            <WorkspaceEmptyState
              title="Unable to load purchase order"
              description="The order could not be fetched. Close this panel and try again."
            />
          ) : null}

          {order ? (
            <>
              <DocumentStatusFlow
                status={formatDocumentStatus(order.status)}
                tone={documentStatusTone(order.status)}
                transitions={transitions}
                isPending={isPending}
              />

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="ops-panel-label">Supplier</dt>
                  <dd>{supplierNameById.get(order.supplierId) ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Warehouse</dt>
                  <dd>
                    {warehouseNameById.get(order.warehouseId) ?? 'Unknown'}
                  </dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Ordered</dt>
                  <dd>{formatDate(order.orderDate)}</dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Expected</dt>
                  <dd>{formatDate(order.expectedDate)}</dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Payment terms</dt>
                  <dd>{order.paymentTerms ?? '—'}</dd>
                </div>
                <div>
                  <dt className="ops-panel-label">Grand total</dt>
                  <dd className="font-medium tabular-nums">
                    {formatMoney(order.grandTotal)} {order.currencyCode}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="ops-panel-label">Notes</dt>
                  <dd className="text-muted-foreground">
                    {order.notes ?? '—'}
                  </dd>
                </div>
              </dl>

              <div>
                <span className="ops-panel-label">Lines</span>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Product</th>
                        <th className="px-3 py-2 text-end font-semibold">
                          Ordered
                        </th>
                        <th className="px-3 py-2 text-end font-semibold">
                          Received
                        </th>
                        <th className="px-3 py-2 text-end font-semibold">
                          Unit cost
                        </th>
                        <th className="px-3 py-2 text-end font-semibold">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((line) => (
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
                            {formatQty(line.orderedQty)}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {formatQty(line.receivedQty)}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {formatMoney(line.unitCost)}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {formatMoney(line.lineTotal)}
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
