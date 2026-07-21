import { createFileRoute } from '@tanstack/react-router'
import { PurchaseOrderWorkspace } from '#/features/purchasing/purchase-order-workspace'

export const Route = createFileRoute('/_app/purchase/orders')({
  component: PurchaseOrdersPage,
})

function PurchaseOrdersPage() {
  return <PurchaseOrderWorkspace />
}
