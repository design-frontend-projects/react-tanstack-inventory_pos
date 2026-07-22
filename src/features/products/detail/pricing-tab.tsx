'use client'

import * as React from 'react'

import { DataTable } from '#/components/data/data-table'
import { StatusChip } from '#/components/board/status-chip'
import { useProductPrices } from '#/features/pricing/use-pricing'
import { useUoms } from '#/features/products/use-master-data'
import {
  formatDate,
  formatMoney,
  formatQuantity,
} from '#/features/products/detail/product-detail-shared'
import type { DataTableColumn } from '#/components/data/data-table'

type PriceRow = NonNullable<ReturnType<typeof useProductPrices>['data']>[number]

// Pricing tab: every tiered price entry for this product across all price lists.

export function ProductPricingTab({ productId }: { productId: string }) {
  const pricesQuery = useProductPrices({ productId })
  const uomsQuery = useUoms()

  const uomLabelById = React.useMemo(() => {
    return new Map((uomsQuery.data ?? []).map((uom) => [uom.id, uom.name]))
  }, [uomsQuery.data])

  const columns = React.useMemo<Array<DataTableColumn<PriceRow>>>(
    () => [
      {
        id: 'priceList',
        header: 'Price List',
        cell: (row) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.priceList.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.priceList.code}
            </span>
          </span>
        ),
        sortValue: (row) => row.priceList.name,
      },
      {
        id: 'uom',
        header: 'UoM',
        cell: (row) => uomLabelById.get(row.uomId) ?? '—',
        sortValue: (row) => uomLabelById.get(row.uomId) ?? '',
      },
      {
        id: 'minQty',
        header: 'Min Qty',
        align: 'end',
        cell: (row) => formatQuantity(row.minQty),
        sortValue: (row) => Number(row.minQty),
      },
      {
        id: 'unitPrice',
        header: 'Unit Price',
        align: 'end',
        cell: (row) => (
          <span className="font-medium">{formatMoney(row.unitPrice)}</span>
        ),
        sortValue: (row) => Number(row.unitPrice),
      },
      {
        id: 'taxIncluded',
        header: 'Tax',
        cell: (row) => (
          <StatusChip tone={row.taxIncluded ? 'info' : 'neutral'}>
            {row.taxIncluded ? 'Tax included' : 'Tax excluded'}
          </StatusChip>
        ),
        sortValue: (row) => (row.taxIncluded ? 1 : 0),
      },
      {
        id: 'validity',
        header: 'Validity',
        cell: (row) =>
          row.validFrom || row.validTo
            ? `${formatDate(row.validFrom)} → ${formatDate(row.validTo)}`
            : 'Always',
        sortValue: (row) => String(row.validFrom ?? ''),
      },
    ],
    [uomLabelById],
  )

  return (
    <DataTable
      columns={columns}
      rows={pricesQuery.data ?? []}
      rowKey={(row) => row.id}
      isLoading={pricesQuery.isLoading}
      isError={pricesQuery.isError}
      errorMessage="Price entries could not be loaded."
      emptyTitle="No price entries"
      emptyDescription="This product has no entries on any price list yet. It sells at its default price."
      pageSize={10}
    />
  )
}
