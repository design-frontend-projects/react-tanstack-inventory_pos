import { createFileRoute } from '@tanstack/react-router'
import { AdjustmentWorkspace } from '#/features/inventory/adjustment-workspace'

export const Route = createFileRoute('/_app/inventory/adjustments')({
  component: AdjustmentsPage,
})

function AdjustmentsPage() {
  return <AdjustmentWorkspace />
}
