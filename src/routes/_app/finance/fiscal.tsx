import { createFileRoute } from '@tanstack/react-router'
import { FinanceFiscalWorkspace } from '#/features/finance/fiscal-workspace'

export const Route = createFileRoute('/_app/finance/fiscal')({
  component: FinanceFiscalPage,
})

function FinanceFiscalPage() {
  return <FinanceFiscalWorkspace />
}
