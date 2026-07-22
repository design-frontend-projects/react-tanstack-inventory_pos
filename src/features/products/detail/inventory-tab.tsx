'use client'

import { DataTable } from '#/components/data/data-table'
import { useStock } from '#/features/inventory/use-stock'
import {
  formatMoney,
  formatQuantity,
} from '#/features/products/detail/product-detail-shared'
import type { DataTableColumn } from '#/components/data/data-table'

type StockRow = NonNullable<ReturnType<typeof useStock>['data']>[number]

// Inventory tab: the per-warehouse/location balance rows for this product,
// straight from the stock ledger's balance table.

const columns: Array<DataTableColumn<StockRow>> = [
  {
    id: 'warehouse',
    header: 'Warehouse',
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.warehouse?.name ?? '—'}</span>
        {row.warehouse?.code ? (
          <span className="font-mono text-xs text-muted-foreground">
            {row.warehouse.code}
          </span>
        ) : null}
      </span>
    ),
    sortValue: (row) => row.warehouse?.name ?? '',
  },
  {
    id: 'location',
    header: 'Location',
    cell: (row) => row.location?.name ?? row.location?.code ?? '—',
    sortValue: (row) => row.location?.name ?? '',
  },
  {
    id: 'onHand',
    header: 'On Hand',
    align: 'end',
    cell: (row) => formatQuantity(row.onHand),
    sortValue: (row) => Number(row.onHand),
  },
  {
    id: 'reserved',
    header: 'Reserved',
    align: 'end',
    cell: (row) => formatQuantity(row.reserved),
    sortValue: (row) => Number(row.reserved),
  },
  {
    id: 'allocated',
    header: 'Allocated',
    align: 'end',
    cell: (row) => formatQuantity(row.allocated),
    sortValue: (row) => Number(row.allocated),
  },
  {
    id: 'available',
    header: 'Available',
    align: 'end',
    cell: (row) => (
      <span className="font-medium">{formatQuantity(row.available)}</span>
    ),
    sortValue: (row) => Number(row.available),
  },
  {
    id: 'avgUnitCost',
    header: 'Avg Cost',
    align: 'end',
    cell: (row) => formatMoney(row.avgUnitCost),
    sortValue: (row) => Number(row.avgUnitCost),
  },
  {
    id: 'totalValue',
    header: 'Value',
    align: 'end',
    cell: (row) => formatMoney(row.totalValue),
    sortValue: (row) => Number(row.totalValue),
  },
]

export function ProductInventoryTab({ productId }: { productId: string }) {
  const stockQuery = useStock({ productId })

  return (
    <DataTable
      columns={columns}
      rows={stockQuery.data ?? []}
      rowKey={(row) => row.id}
      isLoading={stockQuery.isLoading}
      isError={stockQuery.isError}
      errorMessage="Stock balances could not be loaded."
      emptyTitle="No stock on record"
      emptyDescription="This product has no balance rows yet. Receive stock or post an opening balance to see it here."
      pageSize={15}
    />
  )
}
