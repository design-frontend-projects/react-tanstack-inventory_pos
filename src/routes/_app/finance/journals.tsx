import { createFileRoute } from '@tanstack/react-router'
import { FinanceJournalsWorkspace } from '#/features/finance/journals-workspace'

export const Route = createFileRoute('/_app/finance/journals')({
  component: FinanceJournalsPage,
})

function FinanceJournalsPage() {
  return <FinanceJournalsWorkspace />
}
