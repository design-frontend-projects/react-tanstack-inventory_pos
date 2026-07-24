import { createFileRoute } from '@tanstack/react-router'
import { FinanceJournalTypesWorkspace } from '#/features/finance/journal-types-workspace'

export const Route = createFileRoute('/_app/finance/journal-types')({
  component: FinanceJournalTypesPage,
})

function FinanceJournalTypesPage() {
  return <FinanceJournalTypesWorkspace />
}
