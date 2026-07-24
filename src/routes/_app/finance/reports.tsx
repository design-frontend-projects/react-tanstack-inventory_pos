import { createFileRoute } from '@tanstack/react-router'
import { FinanceReportsWorkspace } from '#/features/finance/reports-workspace'

export const Route = createFileRoute('/_app/finance/reports')({
  component: FinanceReportsPage,
})

function FinanceReportsPage() {
  return <FinanceReportsWorkspace />
}
