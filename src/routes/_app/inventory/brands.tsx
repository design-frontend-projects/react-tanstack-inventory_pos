import { createFileRoute } from '@tanstack/react-router'
import { BrandWorkspace } from '#/features/products/brand-workspace'

export const Route = createFileRoute('/_app/inventory/brands')({
  component: BrandsPage,
})

function BrandsPage() {
  return <BrandWorkspace />
}
