'use client'

import * as React from 'react'

import {
  DetailMetaGrid,
  DetailPage,
  DetailPageHeader,
} from '#/components/layout/detail-page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { StatusChip } from '#/components/board/status-chip'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { AuditTrail } from '#/components/documents/audit-trail'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useProduct } from '#/features/products/use-products'
import {
  useBrands,
  useCategories,
  useUoms,
} from '#/features/products/use-master-data'
import { ProductOverviewTab } from '#/features/products/detail/overview-tab'
import { ProductPricingTab } from '#/features/products/detail/pricing-tab'
import { ProductInventoryTab } from '#/features/products/detail/inventory-tab'
import { ProductMovementsTab } from '#/features/products/detail/movements-tab'
import { ProductLotsSerialsTab } from '#/features/products/detail/lots-serials-tab'
import { ProductPurchaseHistoryTab } from '#/features/products/detail/purchase-history-tab'
import {
  formatEnumLabel,
  formatMoney,
  formatQuantity,
  productStatusTone,
} from '#/features/products/detail/product-detail-shared'
import type { DetailMetaEntry } from '#/components/layout/detail-page'

// Full-page product detail hub. Radix Tabs unmount inactive panels by default,
// so each tab's queries only fire the first time that tab is opened.

function lookupName(
  rows: Array<{ id: string; name: string }> | undefined,
  id: string | null,
): string {
  if (!id) {
    return '—'
  }

  return rows?.find((row) => row.id === id)?.name ?? '—'
}

export function ProductDetailPage({ productId }: { productId: string }) {
  const productQuery = useProduct(productId)
  const brandsQuery = useBrands()
  const categoriesQuery = useCategories()
  const uomsQuery = useUoms()
  const { roles, permissions } = usePermissions()

  const product = productQuery.data
  const errorMessage =
    productQuery.error instanceof Error
      ? productQuery.error.message
      : 'We could not load this product.'
  const notFound = productQuery.isError && /not found/i.test(errorMessage)

  const metaEntries = React.useMemo<Array<DetailMetaEntry>>(() => {
    if (!product) {
      return []
    }

    return [
      { label: 'SKU', value: <span className="font-mono">{product.sku}</span> },
      {
        label: 'Category',
        value: lookupName(categoriesQuery.data, product.categoryId),
      },
      { label: 'Brand', value: lookupName(brandsQuery.data, product.brandId) },
      {
        label: 'Base UoM',
        value: lookupName(uomsQuery.data, product.baseUomId),
      },
      {
        label: 'Costing Method',
        value: formatEnumLabel(product.costingMethod),
      },
      { label: 'Standard Cost', value: formatMoney(product.standardCost) },
      { label: 'Default Price', value: formatMoney(product.defaultPrice) },
      {
        label: 'Tracking Policy',
        value: formatEnumLabel(product.trackingPolicy),
      },
      { label: 'Reorder Point', value: formatQuantity(product.reorderPoint) },
    ]
  }, [product, brandsQuery.data, categoriesQuery.data, uomsQuery.data])

  const header = (
    <DetailPageHeader
      eyebrow="Inventory · Catalog"
      title={product?.name ?? 'Product'}
      description={
        product
          ? `${product.sku} · ${formatEnumLabel(product.productType)}`
          : undefined
      }
      backTo="/inventory/catalog"
      backLabel="Back to catalog"
      status={
        product ? (
          <StatusChip tone={productStatusTone(product.status)} dot>
            {formatEnumLabel(product.status)}
          </StatusChip>
        ) : undefined
      }
    />
  )

  return (
    <DetailPage
      isLoading={productQuery.isPending}
      isError={productQuery.isError && !notFound}
      notFound={notFound}
      errorMessage={errorMessage}
      notFoundTitle="Product not found"
      notFoundDescription="This product may have been deleted, or you may not have access to it."
      header={header}
    >
      {product ? (
        <>
          <DetailMetaGrid entries={metaEntries} />

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="lots-serials">Lots &amp; Serials</TabsTrigger>
              <TabsTrigger value="purchase-history">
                Purchase History
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ProductOverviewTab product={product} />
            </TabsContent>

            <TabsContent value="pricing">
              <ProductPricingTab productId={productId} />
            </TabsContent>

            <TabsContent value="inventory">
              <ProductInventoryTab productId={productId} />
            </TabsContent>

            <TabsContent value="movements">
              <ProductMovementsTab productId={productId} />
            </TabsContent>

            <TabsContent value="lots-serials">
              <ProductLotsSerialsTab
                productId={productId}
                trackingPolicy={product.trackingPolicy}
              />
            </TabsContent>

            <TabsContent value="purchase-history">
              <ProductPurchaseHistoryTab />
            </TabsContent>

            <TabsContent value="activity">
              <AccessGuard
                permissions={['product.view']}
                userRoles={roles}
                userPermissions={permissions}
                fallback={
                  <WorkspaceEmptyState
                    title="Access restricted"
                    description="You do not have permission to view this product's activity."
                  />
                }
              >
                <AuditTrail entityType="product" entityId={productId} />
              </AccessGuard>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </DetailPage>
  )
}
