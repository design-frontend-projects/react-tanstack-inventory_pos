import { createFileRoute } from '@tanstack/react-router'
import { FinanceDashboardWorkspace } from '#/features/finance/dashboard-workspace'

export const Route = createFileRoute('/_app/finance/dashboard')({
  component: FinanceDashboardPage,
})

function FinanceDashboardPage() {
  return <FinanceDashboardWorkspace />
}
