'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { useInventoryKpis } from '#/features/inventory/use-inventory-analytics'
import { LabelPrintDialog } from '#/features/products/barcode/label-print-dialog'
import { ScanDialog } from '#/features/products/barcode/scan-dialog'
import { ProductImportWizard } from '#/features/products/import/product-import-wizard'
import { MasterDataPanel } from '#/features/products/master-data-panel'
import { ProductCreateWizard } from '#/features/products/product-create-wizard'
import { ProductFormDialog } from '#/features/products/product-form-dialog'
import type { LabelProduct } from '#/features/products/barcode/label-print-dialog'
import type { ProductFormValues } from '#/features/products/product-form-dialog'
import { useBrands, useCategories } from '#/features/products/use-master-data'
import { useProductsPage } from '#/features/products/use-products'
import type { ProductListFilters } from '#/features/products/use-products'

const PAGE_SIZE = 25
const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED']

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium capitalize">
      {status.toLowerCase()}
    </span>
  )
}

const filterSelectClassName =
  'h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

export function ProductWorkspace() {
  const [search, setSearch] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [brandId, setBrandId] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [page, setPage] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [scanOpen, setScanOpen] = React.useState(false)
  const [labelProduct, setLabelProduct] = React.useState<LabelProduct | null>(
    null,
  )
  const [editing, setEditing] = React.useState<ProductFormValues | null>(null)

  const productsQuery = useProductsPage({
    search: search || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    status: (status || undefined) as ProductListFilters['status'],
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  })
  const categoriesQuery = useCategories()
  const brandsQuery = useBrands()
  const kpisQuery = useInventoryKpis()

  const data = productsQuery.data
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const categoryName = new Map(
    (categoriesQuery.data ?? []).map((category) => [
      category.id,
      category.name,
    ]),
  )
  const brandName = new Map(
    (brandsQuery.data ?? []).map((brand) => [brand.id, brand.name]),
  )

  // Filter changes reset paging so the skip never points past the new total.
  const applyFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setPage(0)
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (product: ProductFormValues) => {
    setEditing(product)
    setDialogOpen(true)
  }

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Catalog"
      title="Manage the product master: identity, units, costing, and replenishment."
      description="Every sellable and stockable item in one register — classification, tracking policy, pricing, and reorder thresholds feeding POS, purchasing, and the stock ledger."
      actions={
        <>
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            Scan
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
          <Button variant="outline" onClick={() => setWizardOpen(true)}>
            Guided create
          </Button>
          <Button onClick={openCreate}>New product</Button>
        </>
      }
      metrics={[
        {
          label: 'Products',
          value: data ? String(total) : '—',
          hint: 'Matching the current filters',
          tone: 'red',
        },
        {
          label: 'Low stock',
          value: kpisQuery.data ? String(kpisQuery.data.lowStockCount) : '—',
          hint: 'Below their reorder point',
          tone: 'accent',
        },
        {
          label: 'Stock value',
          value: kpisQuery.data
            ? Number(kpisQuery.data.totalValue).toLocaleString()
            : '—',
          hint: 'Weighted-average valuation',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Product register"
        title="Product master"
        description="Search by SKU, name, or barcode. Filter by category, brand, or lifecycle status."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => applyFilter(setSearch)(event.target.value)}
            placeholder="Search products…"
            className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <select
            value={categoryId}
            onChange={(event) => applyFilter(setCategoryId)(event.target.value)}
            className={filterSelectClassName}
          >
            <option value="">All categories</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={brandId}
            onChange={(event) => applyFilter(setBrandId)(event.target.value)}
            className={filterSelectClassName}
          >
            <option value="">All brands</option>
            {(brandsQuery.data ?? []).map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => applyFilter(setStatus)(event.target.value)}
            className={filterSelectClassName}
          >
            <option value="">All statuses</option>
            {PRODUCT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option.toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {productsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading products…</p>
        ) : productsQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load products"
            description="Check your connection and permissions, then retry."
          />
        ) : items.length === 0 ? (
          <WorkspaceEmptyState
            title="No products found"
            description="Create your first product or adjust the filters."
          >
            <Button onClick={openCreate}>Create product</Button>
          </WorkspaceEmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Brand</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 text-right font-medium">Cost</th>
                  <th className="py-2 pr-4 text-right font-medium">Price</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-mono text-xs">
                      {product.sku}
                    </td>
                    <td className="py-2 pr-4 font-medium">{product.name}</td>
                    <td className="py-2 pr-4">
                      {product.categoryId
                        ? (categoryName.get(product.categoryId) ?? '—')
                        : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      {product.brandId
                        ? (brandName.get(product.brandId) ?? '—')
                        : '—'}
                    </td>
                    <td className="py-2 pr-4 lowercase">
                      {product.productType}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {product.standardCost ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {product.defaultPrice ?? '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-2">
                        <Button size="xs" variant="outline" asChild>
                          <Link
                            to="/inventory/catalog/$productId"
                            params={{ productId: product.id }}
                          >
                            View
                          </Link>
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEdit(product)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setLabelProduct(product)}
                        >
                          Label
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {pageCount} · {total} products
          </span>
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((previous) => Math.max(0, previous - 1))}
            >
              Previous
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((previous) => previous + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </WorkspacePanel>

      <MasterDataPanel />

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
      />

      <ProductCreateWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      <ProductImportWizard open={importOpen} onOpenChange={setImportOpen} />

      <ScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onPrintLabel={(product) => {
          setScanOpen(false)
          setLabelProduct(product)
        }}
      />

      <LabelPrintDialog
        open={labelProduct !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setLabelProduct(null)
          }
        }}
        product={labelProduct}
      />
    </WorkspacePage>
  )
}
