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
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'
import { useProductsPage } from '#/features/products/use-products'
import { useUoms } from '#/features/products/use-master-data'
import { useSuppliers } from '#/features/suppliers/use-suppliers'
import {
  useLocations,
  useWarehouses,
} from '#/features/warehouses/use-warehouses'
import {
  useGoodsReceipt,
  useGoodsReceiptMutations,
  useGoodsReceipts,
  usePurchaseOrderDetail,
  usePurchaseOrdersLookup,
} from '#/features/purchasing/use-goods-receipts'

// ReceiptStatus (prisma) — the register filters on the raw uppercase values.
const RECEIPT_STATUSES = [
  'DRAFT',
  'RECEIVED',
  'QUALITY_CHECK',
  'PUT_AWAY',
  'COMPLETED',
  'REJECTED',
] as const

const RECEIVE_PERMISSION = 'purchase.po_receive'
const VIEW_PERMISSIONS = ['purchase.po_receive', 'purchase.po_view']

function formatQty(value: string | number | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
}

type GoodsReceiptRow = NonNullable<
  ReturnType<typeof useGoodsReceipts>['data']
>[number]

export function GoodsReceiptWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canReceive = can([RECEIVE_PERMISSION])

  const [status, setStatus] = React.useState('')
  const [warehouseId, setWarehouseId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isCreateOpen, setCreateOpen] = React.useState(false)

  // Create-form state.
  const [formSupplierId, setFormSupplierId] = React.useState('')
  const [formWarehouseId, setFormWarehouseId] = React.useState('')
  const [formPurchaseOrderId, setFormPurchaseOrderId] = React.useState('')
  const [formDeliveryNote, setFormDeliveryNote] = React.useState('')
  const [lines, setLines] = React.useState<DocumentLine[]>([createEmptyLine()])
  const [lineErrors, setLineErrors] = React.useState<
    Record<string, Partial<Record<string, string>>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)

  const receiptsQuery = useGoodsReceipts()
  const warehousesQuery = useWarehouses()
  const suppliersQuery = useSuppliers({ pageSize: 200 })
  const productsQuery = useProductsPage({ take: 200 })
  const uomsQuery = useUoms()
  const purchaseOrdersQuery = usePurchaseOrdersLookup()
  const locationsQuery = useLocations(formWarehouseId || null)
  const detailQuery = useGoodsReceipt(selectedId)
  const purchaseOrderDetailQuery = usePurchaseOrderDetail(
    formPurchaseOrderId || null,
  )
  const { createGoodsReceipt, postGoodsReceipt } = useGoodsReceiptMutations()

  const receipts = receiptsQuery.data ?? []
  const warehouses = warehousesQuery.data ?? []
  const suppliers = suppliersQuery.data?.items ?? []
  const products = productsQuery.data?.items ?? []
  const uoms = uomsQuery.data ?? []
  const purchaseOrders = purchaseOrdersQuery.data ?? []
  const locations = locationsQuery.data ?? []

  const warehouseName = (id: string) =>
    warehouses.find((warehouse) => warehouse.id === id)?.name ?? '—'
  const supplierName = (id: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? '—'
  const productLabel = (id: string) => {
    const product = products.find((candidate) => candidate.id === id)
    return product ? `${product.name} (${product.sku})` : id.slice(0, 8)
  }

  // Prefill the lines from the selected purchase order: the outstanding
  // quantity per line (ordered minus already received) is what a receiver
  // normally books. Destination location still has to be chosen per line.
  const prefilledPoIdRef = React.useRef<string | null>(null)
  const purchaseOrderDetail = purchaseOrderDetailQuery.data

  React.useEffect(() => {
    if (
      !purchaseOrderDetail ||
      prefilledPoIdRef.current === purchaseOrderDetail.id
    ) {
      return
    }

    prefilledPoIdRef.current = purchaseOrderDetail.id
    setFormSupplierId(purchaseOrderDetail.supplierId)
    setFormWarehouseId(purchaseOrderDetail.warehouseId)
    setLines(
      purchaseOrderDetail.lines.map((line) => {
        const outstanding = Number(line.orderedQty) - Number(line.receivedQty)

        return {
          ...createEmptyLine(),
          productId: line.productId,
          purchaseOrderLineId: line.id,
          variantId: line.variantId ?? '',
          uomId: line.uomId,
          toLocationId: '',
          quantity: String(outstanding > 0 ? outstanding : 0),
          unitCost: line.unitCost,
        }
      }),
    )
    setLineErrors({})
  }, [purchaseOrderDetail])

  function resetForm() {
    prefilledPoIdRef.current = null
    setFormSupplierId('')
    setFormWarehouseId('')
    setFormPurchaseOrderId('')
    setFormDeliveryNote('')
    setLines([createEmptyLine()])
    setLineErrors({})
    setFormError(null)
  }

  const visibleReceipts = React.useMemo(() => {
    const needle = search.trim().toLowerCase()

    return receipts.filter((receipt) => {
      if (status && receipt.status !== status) {
        return false
      }
      if (warehouseId && receipt.warehouseId !== warehouseId) {
        return false
      }
      if (needle && !receipt.documentNumber.toLowerCase().includes(needle)) {
        return false
      }
      return true
    })
  }, [receipts, status, warehouseId, search])

  const postedCount = receipts.filter((receipt) => receipt.isPosted).length
  const awaitingCount = receipts.length - postedCount

  async function handleSubmit() {
    setFormError(null)

    const errors = validateLines(lines, {
      requireUnitCost: true,
      requiredFields: ['uomId', 'toLocationId'],
    })

    if (lines.length === 0) {
      setFormError('Add at least one line before saving this receipt.')
      return
    }

    if (Object.keys(errors).length > 0) {
      setLineErrors(errors)
      setFormError('Fix the highlighted lines before saving this receipt.')
      return
    }

    if (!formSupplierId || !formWarehouseId) {
      setFormError('Choose a supplier and a receiving warehouse.')
      return
    }

    setLineErrors({})

    try {
      await createGoodsReceipt.mutateAsync({
        purchaseOrderId: formPurchaseOrderId || null,
        supplierId: formSupplierId,
        warehouseId: formWarehouseId,
        supplierDeliveryNote: formDeliveryNote.trim() || null,
        // Everything received is accepted by default; rejections are handled by
        // the quality-check step rather than at capture time.
        lines: lines.map((line) => ({
          purchaseOrderLineId: line.purchaseOrderLineId || null,
          productId: line.productId,
          variantId: line.variantId || null,
          toLocationId: line.toLocationId as string,
          uomId: line.uomId as string,
          receivedQty: line.quantity,
          acceptedQty: line.quantity,
          unitCost: line.unitCost as string,
        })),
      })

      notifySuccess('Goods receipt created', 'Post it to move the stock in.')
      setCreateOpen(false)
      resetForm()
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not create the receipt.',
      )
      notifyError(error, 'Could not create the goods receipt')
    }
  }

  async function handlePost(id: string) {
    try {
      await postGoodsReceipt.mutateAsync(id)
      notifySuccess(
        'Goods receipt posted',
        'Stock has been moved into the warehouse.',
      )
    } catch (error) {
      notifyError(error, 'Could not post the goods receipt')
    }
  }

  const columns: DataTableColumn<GoodsReceiptRow>[] = React.useMemo(
    () => [
      {
        id: 'documentNumber',
        header: 'Document',
        cell: (row) => (
          <span className="font-medium">{row.documentNumber}</span>
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
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: (row) => supplierName(row.supplierId),
        sortValue: (row) => supplierName(row.supplierId),
        exportValue: (row) => supplierName(row.supplierId),
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) => warehouseName(row.warehouseId),
        sortValue: (row) => warehouseName(row.warehouseId),
        exportValue: (row) => warehouseName(row.warehouseId),
      },
      {
        id: 'deliveryNote',
        header: 'Delivery note',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.supplierDeliveryNote ?? '—'}
          </span>
        ),
        sortValue: (row) => row.supplierDeliveryNote ?? '',
        exportValue: (row) => row.supplierDeliveryNote ?? '',
        defaultHidden: true,
      },
      {
        id: 'receiptDate',
        header: 'Received',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(row.receiptDate).toLocaleDateString()}
          </span>
        ),
        sortValue: (row) => new Date(row.receiptDate).getTime(),
        exportValue: (row) => new Date(row.receiptDate).toISOString(),
      },
      {
        id: 'posted',
        header: 'Posted',
        cell: (row) =>
          row.isPosted ? (
            <StatusChip tone="success">Posted</StatusChip>
          ) : (
            <StatusChip tone="neutral">Unposted</StatusChip>
          ),
        sortValue: (row) => (row.isPosted ? 1 : 0),
        exportValue: (row) => (row.isPosted ? 'posted' : 'unposted'),
      },
    ],
    // Label lookups depend on the reference data being loaded.
    [suppliers, warehouses],
  )

  const detail = detailQuery.data

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Goods receipts"
      title="Book what actually arrived on the dock."
      description="Capture supplier deliveries against their purchase orders, record the destination bin and cost per line, then post — posting is what writes the stock movement and reconciles the order."
      metrics={[
        {
          label: 'Receipts',
          value: receiptsQuery.isLoading
            ? '—'
            : receipts.length.toLocaleString(),
          hint: 'Most recent deliveries',
          tone: 'red',
        },
        {
          label: 'Awaiting posting',
          value: receiptsQuery.isLoading ? '—' : awaitingCount.toLocaleString(),
          hint: 'Captured but stock not moved yet',
          tone: awaitingCount > 0 ? 'accent' : 'neutral',
        },
        {
          label: 'Posted',
          value: receiptsQuery.isLoading ? '—' : postedCount.toLocaleString(),
          hint: 'Stock already in the warehouse',
          tone: 'neutral',
        },
      ]}
      actions={
        canReceive ? (
          <Button
            size="sm"
            onClick={() => {
              resetForm()
              setCreateOpen(true)
            }}
          >
            New receipt
          </Button>
        ) : null
      }
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Delivery register"
        description="Filter by status, warehouse, or document number, then open a receipt to review its lines and post it."
      >
        <AccessGuard
          permissions={VIEW_PERMISSIONS}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to goods receipts"
              description="Ask an administrator for the 'Receive Purchase Orders' permission to open the delivery register."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={RECEIPT_STATUSES.map((value) => ({
                value,
                label: formatDocumentStatus(value),
              }))}
            />
            <FilterSelect
              label="Warehouse"
              value={warehouseId}
              onChange={setWarehouseId}
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
              rows={visibleReceipts}
              rowKey={(row) => row.id}
              isLoading={receiptsQuery.isLoading}
              isError={receiptsQuery.isError}
              errorMessage="Could not load goods receipts. Check your connection and permissions, then retry."
              emptyTitle="No goods receipts yet"
              emptyDescription="Receipts appear here as deliveries are booked against purchase orders."
              onRowClick={(row) => setSelectedId(row.id)}
              enableColumnVisibility
              exportFileName="goods-receipts"
              pageSize={25}
              stickyHeader
            />
          </div>
        </AccessGuard>
      </WorkspacePanel>

      <DrawerForm
        open={isCreateOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            resetForm()
          }
        }}
        title="New goods receipt"
        description="Record what arrived. Nothing moves in stock until the receipt is posted."
        onSubmit={handleSubmit}
        submitLabel="Create receipt"
        isPending={createGoodsReceipt.isPending}
        error={formError}
        submitDisabled={lines.length === 0}
      >
        <Field
          label="Purchase order"
          hint="Optional. Selecting one prefills the supplier, warehouse, and outstanding lines."
        >
          <select
            className={fieldInputClassName}
            value={formPurchaseOrderId}
            onChange={(event) => setFormPurchaseOrderId(event.target.value)}
          >
            <option value="">No purchase order (direct receipt)</option>
            {purchaseOrders.map((purchaseOrder) => (
              <option key={purchaseOrder.id} value={purchaseOrder.id}>
                {purchaseOrder.documentNumber}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Supplier" required>
          <select
            className={fieldInputClassName}
            value={formSupplierId}
            onChange={(event) => setFormSupplierId(event.target.value)}
          >
            <option value="">Select a supplier…</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Receiving warehouse" required>
          <select
            className={fieldInputClassName}
            value={formWarehouseId}
            onChange={(event) => setFormWarehouseId(event.target.value)}
          >
            <option value="">Select a warehouse…</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Supplier delivery note">
          <input
            className={fieldInputClassName}
            value={formDeliveryNote}
            maxLength={120}
            onChange={(event) => setFormDeliveryNote(event.target.value)}
          />
        </Field>

        <LineItemsEditor
          lines={lines}
          onChange={setLines}
          products={products.map((product) => ({
            value: product.id,
            label: `${product.name} (${product.sku})`,
          }))}
          columns={{
            quantityLabel: 'Received qty',
            unitCostLabel: 'Unit cost',
          }}
          selects={[
            {
              field: 'toLocationId',
              label: 'Destination',
              required: true,
              options: locations.map((location) => ({
                value: location.id,
                label: `${location.code} — ${location.name}`,
              })),
              placeholder: formWarehouseId
                ? 'Select a location…'
                : 'Choose a warehouse first…',
            },
            {
              field: 'uomId',
              label: 'Unit',
              required: true,
              options: uoms.map((uom) => ({
                value: uom.id,
                label: `${uom.code} — ${uom.name}`,
              })),
            },
          ]}
          errors={lineErrors}
          disabled={createGoodsReceipt.isPending}
          addLabel="Add received line"
        />
      </DrawerForm>

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
            <SheetTitle>{detail?.documentNumber ?? 'Goods receipt'}</SheetTitle>
            <SheetDescription>
              {detail
                ? `${supplierName(detail.supplierId)} → ${warehouseName(detail.warehouseId)}`
                : 'Loading the receipt…'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            {detailQuery.isError ? (
              <WorkspaceEmptyState
                title="Could not load this receipt"
                description="Check your connection and permissions, then retry."
              />
            ) : null}

            {detail ? (
              <>
                <DocumentStatusFlow
                  status={formatDocumentStatus(detail.status)}
                  tone={documentStatusTone(detail.status)}
                  isPending={postGoodsReceipt.isPending}
                  transitions={
                    detail.isPosted
                      ? []
                      : [
                          {
                            id: 'post',
                            label: 'Post receipt',
                            permissions: [RECEIVE_PERMISSION],
                            variant: 'default',
                            onAction: () => handlePost(detail.id),
                            confirm: {
                              title: 'Post this goods receipt?',
                              description:
                                'Posting moves the accepted quantities into stock and reconciles the purchase order. This cannot be undone — corrections have to be booked as a separate return or adjustment.',
                              confirmLabel: 'Post and move stock',
                              tone: 'destructive',
                            },
                          },
                        ]
                  }
                />

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Supplier</dt>
                    <dd>{supplierName(detail.supplierId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Warehouse</dt>
                    <dd>{warehouseName(detail.warehouseId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Delivery note
                    </dt>
                    <dd>{detail.supplierDeliveryNote ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Received</dt>
                    <dd>{new Date(detail.receiptDate).toLocaleString()}</dd>
                  </div>
                </dl>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Product</th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Received
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Accepted
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Rejected
                        </th>
                        <th className="py-2 text-right font-medium">
                          Unit cost
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((line) => (
                        <tr key={line.id} className="border-b border-border/60">
                          <td className="py-2 pr-4">
                            {productLabel(line.productId)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {formatQty(line.receivedQty)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {formatQty(line.acceptedQty)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {formatQty(line.rejectedQty)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatQty(line.unitCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </WorkspacePage>
  )
}
