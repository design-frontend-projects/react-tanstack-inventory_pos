import { createFileRoute } from '@tanstack/react-router'
import { JournalEntryEditor } from '#/features/finance/journal-entry-editor'

export const Route = createFileRoute('/_app/finance/journals_/new')({
  component: NewJournalEntryPage,
})

function NewJournalEntryPage() {
  return <JournalEntryEditor />
}
