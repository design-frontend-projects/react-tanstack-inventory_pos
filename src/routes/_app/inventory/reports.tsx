import { createFileRoute } from '@tanstack/react-router'
import { InventoryReportsWorkspace } from '#/features/inventory/reports-workspace'

export const Route = createFileRoute('/_app/inventory/reports')({
  component: InventoryReportsPage,
})

function InventoryReportsPage() {
  return <InventoryReportsWorkspace />
}
