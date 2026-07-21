import { createFileRoute } from '@tanstack/react-router'
import { CountWorkspace } from '#/features/inventory/counts/count-workspace'

export const Route = createFileRoute('/_app/inventory/counts')({
  component: StockCountsPage,
})

function StockCountsPage() {
  return <CountWorkspace />
}
