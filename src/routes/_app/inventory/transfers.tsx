import { createFileRoute } from '@tanstack/react-router'
import { TransferWorkspace } from '#/features/transfers/transfer-workspace'

export const Route = createFileRoute('/_app/inventory/transfers')({
  component: TransfersPage,
})

function TransfersPage() {
  return <TransferWorkspace />
}
