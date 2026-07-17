import { createFileRoute } from '@tanstack/react-router'
import { StockWorkspace } from '#/features/inventory/stock-workspace'

export const Route = createFileRoute('/_app/inventory/stock')({
  component: StockLedgerPage,
})

function StockLedgerPage() {
  return <StockWorkspace />
}
