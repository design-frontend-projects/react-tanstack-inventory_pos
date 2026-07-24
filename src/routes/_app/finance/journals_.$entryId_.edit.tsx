import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { JournalEntryEditor } from '#/features/finance/journal-entry-editor'
import { useJournalEntry } from '#/features/finance/use-fin-journals'

export const Route = createFileRoute('/_app/finance/journals_/$entryId_/edit')({
  component: EditJournalEntryPage,
})

function EditJournalEntryPage() {
  const { entryId } = Route.useParams()
  const entryQuery = useJournalEntry(entryId)

  if (entryQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading draft…</p>
  }

  const entry = entryQuery.data ?? null

  // Only drafts are editable; anything else routes the user back to the voucher.
  if (!entry || entry.statusCode !== 'draft') {
    return (
      <WorkspaceEmptyState
        title="This entry is not editable"
        description="Only draft journal entries can be edited. Posted entries are immutable — correct them with a reversal instead."
      />
    )
  }

  return <JournalEntryEditor entry={entry} />
}
