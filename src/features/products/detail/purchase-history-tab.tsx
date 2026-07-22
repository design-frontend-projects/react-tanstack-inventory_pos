'use client'

import * as React from 'react'

import { DataTable } from '#/components/data/data-table'
import { StatusChip } from '#/components/board/status-chip'
import { usePurchaseOrders } from '#/features/purchasing/use-purchase-orders'
import { useSuppliersLookup } from '#/features/products/use-master-data'
import {
  documentStatusTone,
  formatDate,
  formatEnumLabel,
  formatMoney,
} from '#/features/products/detail/product-detail-shared'
import type { DataTableColumn } from '#/components/data/data-table'

type PurchaseOrderRow = NonNullable<
  ReturnType<typeof usePurchaseOrders>['data']
>[number]

// Purchase History tab. The purchase-order list endpoint returns headers only
// (no line items), so per-product filtering is not possible client-side. The
// tab shows the most recent orders for context and says so explicitly.

export function ProductPurchaseHistoryTab() {
  const ordersQuery = usePurchaseOrders()
  const suppliersQuery = useSuppliersLookup()

  const supplierNameById = React.useMemo(() => {
    return new Map(
      (suppliersQuery.data ?? []).map((supplier) => [
        supplier.id,
        supplier.name,
      ]),
    )
  }, [suppliersQuery.data])

  const columns = React.useMemo<Array<DataTableColumn<PurchaseOrderRow>>>(
    () => [
      {
        id: 'documentNumber',
        header: 'PO #',
        cell: (row) => (
          <span className="font-mono text-xs font-medium">
            {row.documentNumber}
          </span>
        ),
        sortValue: (row) => row.documentNumber,
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: (row) => supplierNameById.get(row.supplierId) ?? '—',
        sortValue: (row) => supplierNameById.get(row.supplierId) ?? '',
      },
      {
        id: 'orderDate',
        header: 'Order Date',
        cell: (row) => formatDate(row.orderDate),
        sortValue: (row) => String(row.orderDate),
      },
      {
        id: 'expectedDate',
        header: 'Expected',
        cell: (row) => formatDate(row.expectedDate),
        sortValue: (row) => String(row.expectedDate ?? ''),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <StatusChip tone={documentStatusTone(row.status)} dot>
            {formatEnumLabel(row.status)}
          </StatusChip>
        ),
        sortValue: (row) => row.status,
      },
      {
        id: 'grandTotal',
        header: 'Grand Total',
        align: 'end',
        cell: (row) => (
          <span className="font-medium">
            {formatMoney(row.grandTotal)}{' '}
            <span className="text-xs text-muted-foreground">
              {row.currencyCode}
            </span>
          </span>
        ),
        sortValue: (row) => Number(row.grandTotal),
      },
    ],
    [supplierNameById],
  )

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
        The purchase-order register returns order headers only, so this list
        shows the workspace&apos;s recent purchase orders rather than orders
        filtered to this product. Open an order from the purchasing module to
        see its line items.
      </p>
      <DataTable
        columns={columns}
        rows={ordersQuery.data ?? []}
        rowKey={(row) => row.id}
        isLoading={ordersQuery.isLoading}
        isError={ordersQuery.isError}
        errorMessage="Purchase orders could not be loaded. You may not have purchasing access."
        emptyTitle="No purchase orders"
        emptyDescription="No purchase orders have been raised in this workspace yet."
        pageSize={10}
      />
    </div>
  )
}
