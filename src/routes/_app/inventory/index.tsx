import { createFileRoute } from '@tanstack/react-router'
import { InventoryDashboard } from '#/features/inventory/inventory-dashboard'

export const Route = createFileRoute('/_app/inventory/')({
  component: InventoryOverviewPage,
})

function InventoryOverviewPage() {
  return <InventoryDashboard />
}
