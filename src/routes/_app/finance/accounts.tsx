import { createFileRoute } from '@tanstack/react-router'
import { FinanceAccountsWorkspace } from '#/features/finance/accounts-workspace'

export const Route = createFileRoute('/_app/finance/accounts')({
  component: FinanceAccountsPage,
})

function FinanceAccountsPage() {
  return <FinanceAccountsWorkspace />
}
