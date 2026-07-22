'use client'

import { KpiGrid, StatCard } from '#/components/data/stat-card'
import { DataTable } from '#/components/data/data-table'
import { StatusChip } from '#/components/board/status-chip'
import { useProductStockSummary } from '#/features/inventory/use-stock'
import {
  formatEnumLabel,
  formatMoney,
  formatQuantity,
} from '#/features/products/detail/product-detail-shared'
import type { DataTableColumn } from '#/components/data/data-table'
import type {
  ProductDetail,
  ProductVariantRow,
} from '#/features/products/detail/product-detail-shared'

// Overview tab: stock KPIs, a details card (description + tracking flags), and
// the variant matrix when the product has variants.

const variantColumns: Array<DataTableColumn<ProductVariantRow>> = [
  {
    id: 'sku',
    header: 'SKU',
    cell: (row) => <span className="font-mono text-xs">{row.sku}</span>,
    sortValue: (row) => row.sku,
  },
  {
    id: 'name',
    header: 'Name',
    cell: (row) => <span className="font-medium">{row.name}</span>,
    sortValue: (row) => row.name,
  },
  {
    id: 'barcode',
    header: 'Barcode',
    cell: (row) => row.barcode ?? '—',
    sortValue: (row) => row.barcode ?? '',
  },
  {
    id: 'priceOverride',
    header: 'Price Override',
    align: 'end',
    cell: (row) => formatMoney(row.priceOverride),
    sortValue: (row) => Number(row.priceOverride ?? 0),
  },
  {
    id: 'costOverride',
    header: 'Cost Override',
    align: 'end',
    cell: (row) => formatMoney(row.costOverride),
    sortValue: (row) => Number(row.costOverride ?? 0),
  },
  {
    id: 'flags',
    header: 'Flags',
    cell: (row) => (
      <span className="flex flex-wrap gap-1">
        {row.isDefault ? <StatusChip tone="primary">Default</StatusChip> : null}
        <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
      </span>
    ),
  },
]

function DetailEntry({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="ops-panel-label">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

export function ProductOverviewTab({ product }: { product: ProductDetail }) {
  const summaryQuery = useProductStockSummary(product.id)
  const summary = summaryQuery.data
  const isLoading = summaryQuery.isLoading

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid>
        <StatCard
          label="On hand"
          value={formatQuantity(summary?.onHand)}
          isLoading={isLoading}
        />
        <StatCard
          label="Reserved"
          value={formatQuantity(summary?.reserved)}
          tone="warning"
          isLoading={isLoading}
        />
        <StatCard
          label="Available"
          value={formatQuantity(summary?.available)}
          tone="success"
          hint="On hand minus reserved and allocated"
          isLoading={isLoading}
        />
        <StatCard
          label="Stock value"
          value={formatMoney(summary?.totalValue)}
          tone="primary"
          isLoading={isLoading}
        />
      </KpiGrid>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip
              tone={product.isStockTracked ? 'success' : 'neutral'}
              dot
            >
              {product.isStockTracked ? 'Stock tracked' : 'Not stock tracked'}
            </StatusChip>
            <StatusChip tone={product.hasExpiry ? 'warning' : 'neutral'} dot>
              {product.hasExpiry ? 'Expiry tracked' : 'No expiry'}
            </StatusChip>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {product.description?.trim()
            ? product.description
            : 'No description recorded for this product.'}
        </p>

        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DetailEntry label="Barcode" value={product.barcode ?? '—'} />
          <DetailEntry
            label="Shelf life"
            value={
              product.shelfLifeDays === null
                ? '—'
                : `${product.shelfLifeDays} days`
            }
          />
          <DetailEntry
            label="Lead time"
            value={
              product.leadTimeDays === null
                ? '—'
                : `${product.leadTimeDays} days`
            }
          />
          <DetailEntry
            label="Safety stock"
            value={formatQuantity(product.safetyStock)}
          />
        </dl>
      </section>

      {product.variants.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Variants ({product.variants.length}) ·{' '}
            {formatEnumLabel(product.productType)}
          </h2>
          <DataTable
            columns={variantColumns}
            rows={product.variants}
            rowKey={(row) => row.id}
            pageSize={10}
          />
        </section>
      ) : null}
    </div>
  )
}
