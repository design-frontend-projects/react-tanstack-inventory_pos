import { createFileRoute } from '@tanstack/react-router'
import { SupplierWorkspace } from '#/features/suppliers/supplier-workspace'

export const Route = createFileRoute('/_app/purchase/suppliers')({
  component: SuppliersPage,
})

function SuppliersPage() {
  return <SupplierWorkspace />
}
