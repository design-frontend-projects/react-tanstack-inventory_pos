import { createFileRoute } from '@tanstack/react-router'
import { InventorySettingsWorkspace } from '#/features/inventory/settings-workspace'

export const Route = createFileRoute('/_app/inventory/settings')({
  component: InventorySettingsPage,
})

function InventorySettingsPage() {
  return <InventorySettingsWorkspace />
}
