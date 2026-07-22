'use client'

import * as React from 'react'

import { DataTable } from '#/components/data/data-table'
import { StatusChip } from '#/components/board/status-chip'
import { useWarehouses } from '#/features/warehouses/use-warehouses'
import {
  useProductLots,
  useProductSerials,
} from '#/features/products/detail/use-product-detail'
import {
  formatDate,
  formatEnumLabel,
  formatQuantity,
  lotStatusTone,
  serialStatusTone,
} from '#/features/products/detail/product-detail-shared'
import type { DataTableColumn } from '#/components/data/data-table'

type LotRow = NonNullable<ReturnType<typeof useProductLots>['data']>[number]
type SerialRow = NonNullable<
  ReturnType<typeof useProductSerials>['data']
>[number]

// Lots & Serials tab: two side-by-side registers. Queries only run when the
// product's tracking policy actually enables the dimension; otherwise the panel
// renders an explanatory empty state without fetching.

const lotColumns: Array<DataTableColumn<LotRow>> = [
  {
    id: 'lotNumber',
    header: 'Lot #',
    cell: (row) => <span className="font-mono text-xs">{row.lotNumber}</span>,
    sortValue: (row) => row.lotNumber,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <StatusChip tone={lotStatusTone(row.status)} dot>
        {formatEnumLabel(row.status)}
      </StatusChip>
    ),
    sortValue: (row) => row.status,
  },
  {
    id: 'expiryDate',
    header: 'Expiry',
    cell: (row) => formatDate(row.expiryDate),
    sortValue: (row) => String(row.expiryDate ?? ''),
  },
  {
    id: 'initialQty',
    header: 'Initial Qty',
    align: 'end',
    cell: (row) => formatQuantity(row.initialQty),
    sortValue: (row) => Number(row.initialQty),
  },
]

export function ProductLotsSerialsTab({
  productId,
  trackingPolicy,
}: {
  productId: string
  trackingPolicy: string
}) {
  const lotsEnabled =
    trackingPolicy === 'LOT' || trackingPolicy === 'LOT_SERIAL'
  const serialsEnabled =
    trackingPolicy === 'SERIAL' || trackingPolicy === 'LOT_SERIAL'

  const lotsQuery = useProductLots(productId, lotsEnabled)
  const serialsQuery = useProductSerials(productId, serialsEnabled)
  const warehousesQuery = useWarehouses()

  const warehouseNameById = React.useMemo(() => {
    return new Map(
      (warehousesQuery.data ?? []).map((warehouse) => [
        warehouse.id,
        warehouse.name,
      ]),
    )
  }, [warehousesQuery.data])

  const serialColumns = React.useMemo<Array<DataTableColumn<SerialRow>>>(
    () => [
      {
        id: 'serialNumber',
        header: 'Serial #',
        cell: (row) => (
          <span className="font-mono text-xs">{row.serialNumber}</span>
        ),
        sortValue: (row) => row.serialNumber,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <StatusChip tone={serialStatusTone(row.status)} dot>
            {formatEnumLabel(row.status)}
          </StatusChip>
        ),
        sortValue: (row) => row.status,
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: (row) =>
          row.currentWarehouseId
            ? (warehouseNameById.get(row.currentWarehouseId) ?? '—')
            : '—',
        sortValue: (row) =>
          row.currentWarehouseId
            ? (warehouseNameById.get(row.currentWarehouseId) ?? '')
            : '',
      },
    ],
    [warehouseNameById],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Lots</h2>
        <DataTable
          columns={lotColumns}
          rows={lotsQuery.data ?? []}
          rowKey={(row) => row.id}
          isLoading={lotsEnabled && lotsQuery.isLoading}
          isError={lotsQuery.isError}
          errorMessage="Lots could not be loaded."
          emptyTitle={lotsEnabled ? 'No lots yet' : 'Lot tracking disabled'}
          emptyDescription={
            lotsEnabled
              ? 'Lots created when receiving this product will appear here.'
              : 'This product does not track lots. Change its tracking policy to enable batch traceability.'
          }
          pageSize={10}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Serial Numbers
        </h2>
        <DataTable
          columns={serialColumns}
          rows={serialsQuery.data ?? []}
          rowKey={(row) => row.id}
          isLoading={serialsEnabled && serialsQuery.isLoading}
          isError={serialsQuery.isError}
          errorMessage="Serial numbers could not be loaded."
          emptyTitle={
            serialsEnabled ? 'No serials yet' : 'Serial tracking disabled'
          }
          emptyDescription={
            serialsEnabled
              ? 'Serial numbers captured when receiving this product will appear here.'
              : 'This product does not track serial numbers. Change its tracking policy to enable unit traceability.'
          }
          pageSize={10}
        />
      </section>
    </div>
  )
}
