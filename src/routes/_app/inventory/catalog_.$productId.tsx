import { createFileRoute } from '@tanstack/react-router'
import { ProductDetailPage } from '#/features/products/detail/product-detail-page'

export const Route = createFileRoute('/_app/inventory/catalog_/$productId')({
  component: ProductDetailRoute,
})

function ProductDetailRoute() {
  const { productId } = Route.useParams()
  return <ProductDetailPage productId={productId} />
}
