'use client'

import { cn } from '#/lib/utils'
import { DataTable } from '#/components/data/data-table'
import { useMovements } from '#/features/inventory/use-stock'
import {
  formatDateTime,
  formatEnumLabel,
  formatQuantity,
} from '#/features/products/detail/product-detail-shared'
import type { DataTableColumn } from '#/components/data/data-table'

type MovementRow = NonNullable<ReturnType<typeof useMovements>['data']>[number]

// Movements tab: the recent ledger entries for this product (the movement
// filter schema supports productId natively).

const columns: Array<DataTableColumn<MovementRow>> = [
  {
    id: 'occurredAt',
    header: 'Date',
    cell: (row) => formatDateTime(row.occurredAt),
    sortValue: (row) => String(row.occurredAt),
  },
  {
    id: 'movementType',
    header: 'Type',
    cell: (row) => formatEnumLabel(row.movementType),
    sortValue: (row) => row.movementType,
  },
  {
    id: 'qtyDelta',
    header: 'Qty Δ',
    align: 'end',
    cell: (row) => {
      const qty = Number(row.qtyDelta)

      return (
        <span
          className={cn(
            'font-medium',
            qty > 0 && 'text-emerald-600 dark:text-emerald-400',
            qty < 0 && 'text-destructive',
          )}
        >
          {qty > 0 ? '+' : ''}
          {formatQuantity(row.qtyDelta)}
        </span>
      )
    },
    sortValue: (row) => Number(row.qtyDelta),
  },
  {
    id: 'warehouse',
    header: 'Warehouse',
    cell: (row) => row.warehouse?.name ?? '—',
    sortValue: (row) => row.warehouse?.name ?? '',
  },
  {
    id: 'sourceDoc',
    header: 'Source Doc',
    cell: (row) => (
      <span className="flex flex-col">
        <span>{formatEnumLabel(row.sourceDocType)}</span>
        {row.sourceDocNumber ? (
          <span className="font-mono text-xs text-muted-foreground">
            {row.sourceDocNumber}
          </span>
        ) : null}
      </span>
    ),
    sortValue: (row) => row.sourceDocNumber ?? row.sourceDocType,
  },
  {
    id: 'runningOnHand',
    header: 'Running Balance',
    align: 'end',
    cell: (row) => formatQuantity(row.runningOnHand),
    sortValue: (row) => Number(row.runningOnHand),
  },
]

export function ProductMovementsTab({ productId }: { productId: string }) {
  const movementsQuery = useMovements({ productId, take: 200 })

  return (
    <DataTable
      columns={columns}
      rows={movementsQuery.data ?? []}
      rowKey={(row) => row.id}
      isLoading={movementsQuery.isLoading}
      isError={movementsQuery.isError}
      errorMessage="Movements could not be loaded."
      emptyTitle="No movements yet"
      emptyDescription="Every receipt, sale, transfer, and adjustment for this product will appear here."
      pageSize={15}
    />
  )
}
