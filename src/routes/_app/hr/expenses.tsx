import { createFileRoute } from '@tanstack/react-router'
import { ExpenseWorkspace } from '#/features/hr/expense-workspace'

export const Route = createFileRoute('/_app/hr/expenses')({
  component: ExpensesPage,
})

function ExpensesPage() {
  return <ExpenseWorkspace />
}
