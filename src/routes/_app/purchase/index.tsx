import { createFileRoute } from '@tanstack/react-router'
import { PurchaseOverviewWorkspace } from '#/features/purchasing/purchase-overview-workspace'

export const Route = createFileRoute('/_app/purchase/')({
  component: PurchaseOverviewPage,
})

function PurchaseOverviewPage() {
  return <PurchaseOverviewWorkspace />
}
