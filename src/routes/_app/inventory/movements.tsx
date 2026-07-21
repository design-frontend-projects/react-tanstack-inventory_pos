import { createFileRoute } from '@tanstack/react-router'
import { MovementLedgerWorkspace } from '#/features/inventory/movement-ledger-workspace'

export const Route = createFileRoute('/_app/inventory/movements')({
  component: MovementLedgerPage,
})

function MovementLedgerPage() {
  return <MovementLedgerWorkspace />
}
