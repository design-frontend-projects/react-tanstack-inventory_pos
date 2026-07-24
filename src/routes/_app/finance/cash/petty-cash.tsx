import { createFileRoute } from '@tanstack/react-router'
import {
  FINANCE_PLACEHOLDERS,
  FinancePlaceholder,
} from '#/features/finance/finance-placeholder'

export const Route = createFileRoute('/_app/finance/cash/petty-cash')({
  component: PlaceholderPage,
})

function PlaceholderPage() {
  return <FinancePlaceholder {...FINANCE_PLACEHOLDERS['finance-petty-cash']} />
}
