import { createFileRoute } from '@tanstack/react-router'
import { JournalEntryDetailPage } from '#/features/finance/journal-entry-detail'

export const Route = createFileRoute('/_app/finance/journals_/$entryId')({
  component: JournalEntryPage,
})

function JournalEntryPage() {
  const { entryId } = Route.useParams()
  return <JournalEntryDetailPage entryId={entryId} />
}
