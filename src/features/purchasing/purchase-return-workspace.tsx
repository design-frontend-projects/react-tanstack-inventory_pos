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
import { usePurchaseOrdersLookup } from '#/features/purchasing/use-goods-receipts'
import {
  usePurchaseReturn,
  usePurchaseReturnMutations,
  usePurchaseReturns,
} from '#/features/purchasing/use-purchase-returns'

// PurchaseReturnStatus (prisma) — the register filters on the raw values.
const RETURN_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'APPROVED',
  'SHIPPED',
  'RECEIVED',
  'REFUNDED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
] as const

const RETURN_PERMISSION = 'purchase.return_manage'

function formatQty(value: string | number | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
}

type PurchaseReturnRow = NonNullable<
  ReturnType<typeof usePurchaseReturns>['data']
>[number]

export function PurchaseReturnWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can([RETURN_PERMISSION])

  const [status, setStatus] = React.useState('')
  const [supplierFilter, setSupplierFilter] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isCreateOpen, setCreateOpen] = React.useState(false)

  // Create-form state.
  const [formSupplierId, setFormSupplierId] = React.useState('')
  const [formWarehouseId, setFormWarehouseId] = React.useState('')
  const [formPurchaseOrderId, setFormPurchaseOrderId] = React.useState('')
  const [formReason, setFormReason] = React.useState('')
  const [lines, setLines] = React.useState<DocumentLine[]>([createEmptyLine()])
  const [lineErrors, setLineErrors] = React.useState<
    Record<string, Partial<Record<string, string>>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)

  const returnsQuery = usePurchaseReturns()
  const warehousesQuery = useWarehouses()
  const suppliersQuery = useSuppliers({ pageSize: 200 })
  const productsQuery = useProductsPage({ take: 200 })
  const uomsQuery = useUoms()
  const purchaseOrdersQuery = usePurchaseOrdersLookup()
  const locationsQuery = useLocations(formWarehouseId || null)
  const detailQuery = usePurchaseReturn(selectedId)
  const { createPurchaseReturn, postPurchaseReturn } =
    usePurchaseReturnMutations()

  const purchaseReturns = returnsQuery.data ?? []
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

  function resetForm() {
    setFormSupplierId('')
    setFormWarehouseId('')
    setFormPurchaseOrderId('')
    setFormReason('')
    setLines([createEmptyLine()])
    setLineErrors({})
    setFormError(null)
  }

  const visibleReturns = React.useMemo(() => {
    const needle = search.trim().toLowerCase()

    return purchaseReturns.filter((purchaseReturn) => {
      if (status && purchaseReturn.status !== status) {
        return false
      }
      if (supplierFilter && purchaseReturn.supplierId !== supplierFilter) {
        return false
      }
      if (
        needle &&
        !purchaseReturn.documentNumber.toLowerCase().includes(needle)
      ) {
        return false
      }
      return true
    })
  }, [purchaseReturns, status, supplierFilter, search])

  const postedCount = purchaseReturns.filter(
    (purchaseReturn) => purchaseReturn.isPosted,
  ).length
  const awaitingCount = purchaseReturns.length - postedCount

  async function handleSubmit() {
    setFormError(null)

    const errors = validateLines(lines, {
      requiredFields: ['uomId', 'fromLocationId'],
    })

    if (lines.length === 0) {
      setFormError('Add at least one line before saving this return.')
      return
    }

    if (Object.keys(errors).length > 0) {
      setLineErrors(errors)
      setFormError('Fix the highlighted lines before saving this return.')
      return
    }

    if (!formSupplierId || !formWarehouseId) {
      setFormError('Choose a supplier and the warehouse the goods ship from.')
      return
    }

    setLineErrors({})

    try {
      await createPurchaseReturn.mutateAsync({
        supplierId: formSupplierId,
        warehouseId: formWarehouseId,
        purchaseOrderId: formPurchaseOrderId || null,
        reason: formReason.trim() || null,
        // An omitted unit cost lets the movement engine value the issue at the
        // current weighted average cost.
        lines: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || null,
          fromLocationId: line.fromLocationId as string,
          uomId: line.uomId as string,
          quantity: line.quantity,
          unitCost: line.unitCost || null,
        })),
      })

      notifySuccess(
        'Purchase return created',
        'Post it to ship the goods back.',
      )
      setCreateOpen(false)
      resetForm()
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not create the return.',
      )
      notifyError(error, 'Could not create the purchase return')
    }
  }

  async function handlePost(id: string) {
    try {
      await postPurchaseReturn.mutateAsync(id)
      notifySuccess(
        'Purchase return posted',
        'Stock has been issued back to the supplier.',
      )
    } catch (error) {
      notifyError(error, 'Could not post the purchase return')
    }
  }

  const columns: DataTableColumn<PurchaseReturnRow>[] = React.useMemo(
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
        header: 'Ships from',
        cell: (row) => warehouseName(row.warehouseId),
        sortValue: (row) => warehouseName(row.warehouseId),
        exportValue: (row) => warehouseName(row.warehouseId),
      },
      {
        id: 'reason',
        header: 'Reason',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.reason ?? '—'}
          </span>
        ),
        sortValue: (row) => row.reason ?? '',
        exportValue: (row) => row.reason ?? '',
        defaultHidden: true,
      },
      {
        id: 'createdAt',
        header: 'Raised',
        cell: (row) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        ),
        sortValue: (row) => new Date(row.createdAt).getTime(),
        exportValue: (row) => new Date(row.createdAt).toISOString(),
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
      eyebrow="Purchase returns"
      title="Send the wrong, damaged, and surplus goods back."
      description="Raise a return against a supplier and the warehouse the goods leave from, line by line. Posting issues the stock out at the recorded cost — or at current weighted average when no cost is given."
      metrics={[
        {
          label: 'Returns',
          value: returnsQuery.isLoading
            ? '—'
            : purchaseReturns.length.toLocaleString(),
          hint: 'All raised returns',
          tone: 'red',
        },
        {
          label: 'Awaiting posting',
          value: returnsQuery.isLoading ? '—' : awaitingCount.toLocaleString(),
          hint: 'Raised but stock not issued yet',
          tone: awaitingCount > 0 ? 'accent' : 'neutral',
        },
        {
          label: 'Posted',
          value: returnsQuery.isLoading ? '—' : postedCount.toLocaleString(),
          hint: 'Stock already shipped back',
          tone: 'neutral',
        },
      ]}
      actions={
        canManage ? (
          <Button
            size="sm"
            onClick={() => {
              resetForm()
              setCreateOpen(true)
            }}
          >
            New return
          </Button>
        ) : null
      }
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Return register"
        description="Filter by status, supplier, or document number, then open a return to review its lines and post it."
      >
        <AccessGuard
          permissions={[RETURN_PERMISSION]}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to purchase returns"
              description="Ask an administrator for the 'Manage Purchase Returns' permission to open the return register."
            />
          }
        >
          <FilterBar>
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={RETURN_STATUSES.map((value) => ({
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
              placeholder="Search document number…"
            />
          </FilterBar>

          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={visibleReturns}
              rowKey={(row) => row.id}
              isLoading={returnsQuery.isLoading}
              isError={returnsQuery.isError}
              errorMessage="Could not load purchase returns. Check your connection and permissions, then retry."
              emptyTitle="No purchase returns yet"
              emptyDescription="Returns appear here once goods are sent back to a supplier."
              onRowClick={(row) => setSelectedId(row.id)}
              enableColumnVisibility
              exportFileName="purchase-returns"
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
        title="New purchase return"
        description="Record what goes back. Nothing leaves stock until the return is posted."
        onSubmit={handleSubmit}
        submitLabel="Create return"
        isPending={createPurchaseReturn.isPending}
        error={formError}
        submitDisabled={lines.length === 0}
      >
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

        <Field label="Warehouse" required hint="Where the goods ship from.">
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

        <Field
          label="Purchase order"
          hint="Optional reference to the original order."
        >
          <select
            className={fieldInputClassName}
            value={formPurchaseOrderId}
            onChange={(event) => setFormPurchaseOrderId(event.target.value)}
          >
            <option value="">No purchase order</option>
            {purchaseOrders.map((purchaseOrder) => (
              <option key={purchaseOrder.id} value={purchaseOrder.id}>
                {purchaseOrder.documentNumber}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reason">
          <input
            className={fieldInputClassName}
            value={formReason}
            maxLength={2000}
            onChange={(event) => setFormReason(event.target.value)}
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
            quantityLabel: 'Return qty',
            unitCostLabel: 'Unit cost (optional)',
          }}
          selects={[
            {
              field: 'fromLocationId',
              label: 'Source location',
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
          disabled={createPurchaseReturn.isPending}
          addLabel="Add return line"
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
            <SheetTitle>
              {detail?.documentNumber ?? 'Purchase return'}
            </SheetTitle>
            <SheetDescription>
              {detail
                ? `${warehouseName(detail.warehouseId)} → ${supplierName(detail.supplierId)}`
                : 'Loading the return…'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
            {detailQuery.isError ? (
              <WorkspaceEmptyState
                title="Could not load this return"
                description="Check your connection and permissions, then retry."
              />
            ) : null}

            {detail ? (
              <>
                <DocumentStatusFlow
                  status={formatDocumentStatus(detail.status)}
                  tone={documentStatusTone(detail.status)}
                  isPending={postPurchaseReturn.isPending}
                  transitions={
                    detail.isPosted
                      ? []
                      : [
                          {
                            id: 'post',
                            label: 'Post return',
                            permissions: [RETURN_PERMISSION],
                            variant: 'default',
                            onAction: () => handlePost(detail.id),
                            confirm: {
                              title: 'Post this purchase return?',
                              description:
                                'Posting issues the returned quantities out of the source locations and reduces on-hand stock. This cannot be undone — corrections have to be booked as a separate receipt or adjustment.',
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
                    <dt className="text-xs text-muted-foreground">
                      Ships from
                    </dt>
                    <dd>{warehouseName(detail.warehouseId)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Reason</dt>
                    <dd>{detail.reason ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Raised</dt>
                    <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
                  </div>
                </dl>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Product</th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Quantity
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
                            {formatQty(line.quantity)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {line.unitCost
                              ? formatQty(line.unitCost)
                              : 'At WAC'}
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
