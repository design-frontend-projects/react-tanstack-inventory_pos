import { createFileRoute } from '@tanstack/react-router'
import { CategoryWorkspace } from '#/features/products/category-workspace'

export const Route = createFileRoute('/_app/inventory/categories')({
  component: CategoriesPage,
})

function CategoriesPage() {
  return <CategoryWorkspace />
}
