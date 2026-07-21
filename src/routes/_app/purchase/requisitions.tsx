import { createFileRoute } from '@tanstack/react-router'
import { RequisitionWorkspace } from '#/features/purchasing/requisition-workspace'

export const Route = createFileRoute('/_app/purchase/requisitions')({
  component: RequisitionsPage,
})

function RequisitionsPage() {
  return <RequisitionWorkspace />
}
