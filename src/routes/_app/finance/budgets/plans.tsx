import { createFileRoute } from '@tanstack/react-router'
import {
  FINANCE_PLACEHOLDERS,
  FinancePlaceholder,
} from '#/features/finance/finance-placeholder'

export const Route = createFileRoute('/_app/finance/budgets/plans')({
  component: PlaceholderPage,
})

function PlaceholderPage() {
  return (
    <FinancePlaceholder {...FINANCE_PLACEHOLDERS['finance-budget-plans']} />
  )
}
