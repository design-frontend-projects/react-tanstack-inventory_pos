'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'

import { AuditTrail } from '#/components/documents/audit-trail'
import {
  DocumentStatusFlow,
  documentStatusTone,
} from '#/components/documents/document-status-flow'
import type { DocumentTransition } from '#/components/documents/document-status-flow'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  DetailMetaGrid,
  DetailPage,
  DetailPageHeader,
} from '#/components/layout/detail-page'
import { WorkspacePanel } from '#/components/layout/workspace-page'
import {
  formatDate,
  formatJournalStatus,
  formatNumber,
  toNumber,
} from '#/features/finance/finance-format'
import type { JournalEntryDetail } from '#/features/finance/use-fin-journals'
import {
  useJournalEntry,
  useJournalMutations,
} from '#/features/finance/use-fin-journals'
import { useFinAccounts } from '#/features/finance/use-fin-accounts'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

type EntryLine = JournalEntryDetail['lines'][number]

export function JournalEntryDetailPage({ entryId }: { entryId: string }) {
  const navigate = useNavigate()
  const entryQuery = useJournalEntry(entryId)
  const accountsQuery = useFinAccounts({})
  const { postEntry, reverseEntry, deleteDraft } = useJournalMutations()

  const entry = entryQuery.data ?? null
  const accountById = React.useMemo(
    () =>
      new Map(
        (accountsQuery.data ?? []).map((account) => [
          account.id,
          `${account.code} — ${account.name}`,
        ]),
      ),
    [accountsQuery.data],
  )

  const isPending =
    postEntry.isPending || reverseEntry.isPending || deleteDraft.isPending

  const transitions: Array<DocumentTransition> = entry
    ? [
        ...(entry.statusCode === 'draft'
          ? [
              {
                id: 'edit',
                label: 'Edit draft',
                permissions: ['finance.journal_create'],
                onAction: () =>
                  navigate({
                    to: '/finance/journals/$entryId/edit',
                    params: { entryId: entry.id },
                  }),
              },
              {
                id: 'post',
                label: 'Post',
                variant: 'default' as const,
                permissions: ['finance.journal_post'],
                confirm: {
                  title: `Post ${entry.entryNumber}?`,
                  description:
                    'Posting writes this entry to the general ledger. Posted entries are immutable and can only be corrected by reversal.',
                  confirmLabel: 'Post entry',
                },
                onAction: async () => {
                  try {
                    const posted = await postEntry.mutateAsync({
                      id: entry.id,
                    })
                    notifySuccess(
                      'Entry posted',
                      `${posted.entryNumber} is now in the ledger.`,
                    )
                  } catch (error: unknown) {
                    notifyError(error, 'Could not post the entry')
                  }
                },
              },
              {
                id: 'delete',
                label: 'Delete draft',
                variant: 'destructive' as const,
                permissions: ['finance.journal_create'],
                confirm: {
                  title: `Delete draft ${entry.entryNumber}?`,
                  description:
                    'The draft is removed from the register. This cannot be undone.',
                  confirmLabel: 'Delete draft',
                  tone: 'destructive' as const,
                },
                onAction: async () => {
                  try {
                    await deleteDraft.mutateAsync(entry.id)
                    notifySuccess(
                      'Draft deleted',
                      `${entry.entryNumber} removed.`,
                    )
                    navigate({ to: '/finance/journals' })
                  } catch (error: unknown) {
                    notifyError(error, 'Could not delete the draft')
                  }
                },
              },
            ]
          : []),
        ...(entry.statusCode === 'posted'
          ? [
              {
                id: 'reverse',
                label: 'Reverse',
                variant: 'destructive' as const,
                permissions: ['finance.journal_reverse'],
                confirm: {
                  title: `Reverse ${entry.entryNumber}?`,
                  description:
                    'A mirrored reversal entry is created and posted in the current open period. The original entry stays in the ledger, marked as reversed.',
                  confirmLabel: 'Reverse entry',
                  tone: 'destructive' as const,
                },
                onAction: async () => {
                  try {
                    const reversal = await reverseEntry.mutateAsync({
                      id: entry.id,
                    })
                    notifySuccess(
                      'Entry reversed',
                      `Reversal ${reversal.entryNumber} posted.`,
                    )
                    navigate({
                      to: '/finance/journals/$entryId',
                      params: { entryId: reversal.id },
                    })
                  } catch (error: unknown) {
                    notifyError(error, 'Could not reverse the entry')
                  }
                },
              },
            ]
          : []),
      ]
    : []

  const columns: Array<DataTableColumn<EntryLine>> = [
    {
      id: 'lineNumber',
      header: '#',
      cell: (line) => line.lineNumber,
      sortValue: (line) => line.lineNumber,
    },
    {
      id: 'account',
      header: 'Account',
      alwaysVisible: true,
      cell: (line) => (
        <span className="font-medium">
          {accountById.get(line.accountId) ?? line.accountId}
        </span>
      ),
      sortValue: (line) => accountById.get(line.accountId) ?? '',
      exportValue: (line) => accountById.get(line.accountId) ?? line.accountId,
    },
    {
      id: 'description',
      header: 'Description',
      cell: (line) => (
        <span className="text-muted-foreground">{line.description ?? '—'}</span>
      ),
      sortValue: (line) => line.description ?? '',
      exportValue: (line) => line.description ?? '',
    },
    {
      id: 'currency',
      header: 'Currency',
      defaultHidden: true,
      cell: (line) => `${line.currencyCode} @ ${line.exchangeRate}`,
      sortValue: (line) => line.currencyCode,
      exportValue: (line) => line.currencyCode,
    },
    {
      id: 'debit',
      header: 'Debit',
      align: 'end',
      cell: (line) =>
        toNumber(line.debitAmount) > 0 ? formatNumber(line.debitAmount) : '—',
      sortValue: (line) => toNumber(line.debitAmount),
      exportValue: (line) => line.debitAmount,
    },
    {
      id: 'credit',
      header: 'Credit',
      align: 'end',
      cell: (line) =>
        toNumber(line.creditAmount) > 0 ? formatNumber(line.creditAmount) : '—',
      sortValue: (line) => toNumber(line.creditAmount),
      exportValue: (line) => line.creditAmount,
    },
    {
      id: 'baseDebit',
      header: 'Base Debit',
      align: 'end',
      defaultHidden: true,
      cell: (line) => formatNumber(line.baseDebitAmount),
      sortValue: (line) => toNumber(line.baseDebitAmount),
      exportValue: (line) => line.baseDebitAmount,
    },
    {
      id: 'baseCredit',
      header: 'Base Credit',
      align: 'end',
      defaultHidden: true,
      cell: (line) => formatNumber(line.baseCreditAmount),
      sortValue: (line) => toNumber(line.baseCreditAmount),
      exportValue: (line) => line.baseCreditAmount,
    },
  ]

  return (
    <DetailPage
      isLoading={entryQuery.isLoading}
      isError={entryQuery.isError}
      notFound={!entryQuery.isLoading && !entryQuery.isError && !entry}
      errorMessage="We could not load this journal entry."
      notFoundTitle="Journal entry not found"
      notFoundDescription="It may have been deleted, or you may not have access to it."
      header={
        <DetailPageHeader
          eyebrow="General Ledger"
          title={entry?.entryNumber ?? 'Journal entry'}
          description={entry?.memo ?? undefined}
          backTo="/finance/journals"
          backLabel="Journal entries"
          status={
            entry ? (
              <DocumentStatusFlow
                status={formatJournalStatus(entry.statusCode)}
                tone={documentStatusTone(entry.statusCode)}
                transitions={transitions}
                isPending={isPending}
              />
            ) : null
          }
        />
      }
    >
      {entry ? (
        <>
          <DetailMetaGrid
            entries={[
              { label: 'Entry date', value: formatDate(entry.entryDate) },
              { label: 'Journal', value: entry.journalType.name },
              { label: 'Fiscal period', value: entry.fiscalPeriod.name },
              { label: 'Currency', value: entry.currencyCode },
              {
                label: 'Reference',
                value: entry.referenceNumber ?? '—',
              },
              {
                label: 'Total debit (base)',
                value: formatNumber(entry.totalBaseDebit),
              },
              {
                label: 'Total credit (base)',
                value: formatNumber(entry.totalBaseCredit),
              },
              {
                label: 'Posted',
                value: entry.postedAt
                  ? formatDate(entry.postedAt)
                  : 'Not posted',
              },
              ...(entry.sourceDocType
                ? [
                    {
                      label: 'Source document',
                      value: `${entry.sourceDocType}`,
                    },
                  ]
                : []),
              ...(entry.reversalOfEntryId
                ? [{ label: 'Reversal of', value: 'Linked entry' }]
                : []),
            ]}
          />

          <WorkspacePanel
            eyebrow="Voucher"
            title="Journal lines"
            description="The debit and credit legs of this entry, in entry currency with base-currency equivalents."
          >
            <DataTable
              columns={columns}
              rows={entry.lines}
              rowKey={(line) => line.id}
              enableColumnVisibility
              exportFileName={`journal-${entry.entryNumber}`}
            />
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="History"
            title="Audit trail"
            description="Every action taken on this entry, actor-attributed."
          >
            <AuditTrail entityType="fin_journal_entry" entityId={entry.id} />
          </WorkspacePanel>
        </>
      ) : (
        <span />
      )}
    </DetailPage>
  )
}
