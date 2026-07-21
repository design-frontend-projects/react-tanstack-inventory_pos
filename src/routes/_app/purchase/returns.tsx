import { createFileRoute } from '@tanstack/react-router'
import { PurchaseReturnWorkspace } from '#/features/purchasing/purchase-return-workspace'

export const Route = createFileRoute('/_app/purchase/returns')({
  component: PurchaseReturnPage,
})

function PurchaseReturnPage() {
  return <PurchaseReturnWorkspace />
}
