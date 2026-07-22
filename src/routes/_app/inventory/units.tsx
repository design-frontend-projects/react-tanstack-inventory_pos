import { createFileRoute } from '@tanstack/react-router'
import { UomWorkspace } from '#/features/products/uom-workspace'

export const Route = createFileRoute('/_app/inventory/units')({
  component: UnitsPage,
})

function UnitsPage() {
  return <UomWorkspace />
}
