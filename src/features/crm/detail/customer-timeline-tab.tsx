'use client'

import * as React from 'react'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { StatusChip } from '#/components/board/status-chip'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { FilterBar, FilterSelect } from '#/components/data/filter-bar'
import {
  useCustomer360Mutations,
  useCustomerTimeline,
} from '#/features/crm/use-customer-360'
import {
  errorMessage,
  formatDateTime,
  timelineEntryMeta,
  timelineMeta,
} from '#/features/crm/crm-format'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

// Chronological customer timeline: event-sourced entries written by the CRM
// projector plus manual notes. Filterable by entry type.

export function CustomerTimelineTab({
  customerId,
  canAddNote,
}: {
  customerId: string
  canAddNote: boolean
}) {
  const [entryType, setEntryType] = React.useState('')
  const [note, setNote] = React.useState('')

  const timelineQuery = useCustomerTimeline(customerId, entryType || undefined)
  const { addNote } = useCustomer360Mutations(customerId)

  const entries = timelineQuery.data ?? []

  async function handleAddNote() {
    const trimmed = note.trim()
    if (trimmed === '') {
      return
    }
    try {
      await addNote.mutateAsync(trimmed)
      setNote('')
      notifySuccess('Note added to the timeline')
    } catch (error: unknown) {
      notifyError(errorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canAddNote ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <label htmlFor="crm-timeline-note" className="text-sm font-semibold">
            Add a note
          </label>
          <textarea
            id="crm-timeline-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Called about the delayed order — promised a follow-up on Sunday…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={note.trim() === '' || addNote.isPending}
              onClick={() => void handleAddNote()}
            >
              {addNote.isPending ? 'Saving…' : 'Add note'}
            </Button>
          </div>
        </div>
      ) : null}

      <FilterBar>
        <FilterSelect
          label="Entry type"
          value={entryType}
          allLabel="All entry types"
          onChange={setEntryType}
          options={Object.entries(timelineEntryMeta).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
      </FilterBar>

      {timelineQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : timelineQuery.isError ? (
        <WorkspaceEmptyState
          title="Unable to load the timeline"
          description="Check your permissions, then retry."
          className="border-destructive/30 bg-destructive/[0.04]"
        />
      ) : entries.length === 0 ? (
        <WorkspaceEmptyState
          title="No timeline entries"
          description="Sales, loyalty, and consent events appear here as they flow through the CRM projector."
        />
      ) : (
        <ol className="relative flex flex-col border-s border-border ps-5">
          {entries.map((entry) => {
            const meta = timelineMeta(entry.entryType)
            return (
              <li key={entry.id} className="relative pb-5 last:pb-0">
                <span
                  aria-hidden
                  className="absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                    <p className="text-sm font-semibold">{entry.title}</p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {formatDateTime(entry.occurredAt)}
                  </time>
                </div>
                {entry.entryType === 'note' &&
                entry.summaryJson &&
                typeof entry.summaryJson === 'object' &&
                'note' in entry.summaryJson ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {String(
                      (entry.summaryJson as Record<string, unknown>).note,
                    )}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
