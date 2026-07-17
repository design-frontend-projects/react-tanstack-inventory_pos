import { createFileRoute } from '@tanstack/react-router'
import { ProductWorkspace } from '#/features/products/product-workspace'

export const Route = createFileRoute('/_app/inventory/catalog')({
  component: CatalogPage,
})

function CatalogPage() {
  return <ProductWorkspace />
}
