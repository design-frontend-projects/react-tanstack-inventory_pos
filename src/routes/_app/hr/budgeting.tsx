import { createFileRoute } from '@tanstack/react-router'
import { BudgetWorkspace } from '#/features/hr/budget-workspace'

export const Route = createFileRoute('/_app/hr/budgeting')({
  component: BudgetingPage,
})

function BudgetingPage() {
  return <BudgetWorkspace />
}
