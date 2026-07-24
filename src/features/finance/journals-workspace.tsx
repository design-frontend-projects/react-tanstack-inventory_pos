'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'

import { StatusChip } from '#/components/board/status-chip'
import { documentStatusTone } from '#/components/documents/document-status-flow'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  FilterTabs,
  filterSelectClassName,
} from '#/components/data/filter-bar'
import {
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  formatDate,
  formatJournalStatus,
  formatNumber,
  toNumber,
} from '#/features/finance/finance-format'
import type { JournalEntryRow } from '#/features/finance/use-fin-journals'
import {
  useJournalEntries,
  useJournalTypes,
} from '#/features/finance/use-fin-journals'

const CREATE_PERMISSIONS = ['finance.journal_create']

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'reversed', label: 'Reversed' },
]

export function FinanceJournalsWorkspace() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canCreate = can(CREATE_PERMISSIONS)

  const [statusFilter, setStatusFilter] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [search, setSearch] = React.useState('')

  const typesQuery = useJournalTypes()
  const entriesQuery = useJournalEntries({
    ...(statusFilter ? { statusCode: statusFilter } : {}),
    ...(typeFilter ? { journalTypeId: typeFilter } : {}),
    ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
  })

  const rows = React.useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = React.useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }
    return rows.filter(
      (row) =>
        row.entryNumber.toLowerCase().includes(normalizedSearch) ||
        (row.referenceNumber ?? '').toLowerCase().includes(normalizedSearch) ||
        (row.memo ?? '').toLowerCase().includes(normalizedSearch),
    )
  }, [rows, normalizedSearch])

  const draftCount = rows.filter((row) => row.statusCode === 'draft').length
  const postedCount = rows.filter((row) => row.statusCode === 'posted').length
  const totalPostedDebit = rows
    .filter((row) => row.statusCode === 'posted')
    .reduce((sum, row) => sum + toNumber(row.totalBaseDebit), 0)

  const columns: Array<DataTableColumn<JournalEntryRow>> = [
    {
      id: 'entryNumber',
      header: 'Entry #',
      alwaysVisible: true,
      cell: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.entryNumber}
        </span>
      ),
      sortValue: (row) => row.entryNumber,
    },
    {
      id: 'entryDate',
      header: 'Date',
      cell: (row) => formatDate(row.entryDate),
      sortValue: (row) => new Date(row.entryDate).getTime(),
      exportValue: (row) => formatDate(row.entryDate),
    },
    {
      id: 'journalType',
      header: 'Journal',
      cell: (row) => row.journalType.name,
      sortValue: (row) => row.journalType.name,
    },
    {
      id: 'period',
      header: 'Period',
      defaultHidden: true,
      cell: (row) => row.fiscalPeriod.name,
      sortValue: (row) => row.fiscalPeriod.name,
    },
    {
      id: 'reference',
      header: 'Reference',
      cell: (row) => row.referenceNumber ?? '—',
      sortValue: (row) => row.referenceNumber ?? '',
    },
    {
      id: 'memo',
      header: 'Memo',
      defaultHidden: true,
      cell: (row) => (
        <span className="line-clamp-1 max-w-64 text-muted-foreground">
          {row.memo ?? '—'}
        </span>
      ),
      sortValue: (row) => row.memo ?? '',
      exportValue: (row) => row.memo ?? '',
    },
    {
      id: 'lines',
      header: 'Lines',
      align: 'end',
      defaultHidden: true,
      cell: (row) => row.lines.length,
      sortValue: (row) => row.lines.length,
    },
    {
      id: 'debit',
      header: 'Debit',
      align: 'end',
      cell: (row) => formatNumber(row.totalBaseDebit),
      sortValue: (row) => toNumber(row.totalBaseDebit),
      exportValue: (row) => row.totalBaseDebit,
    },
    {
      id: 'credit',
      header: 'Credit',
      align: 'end',
      cell: (row) => formatNumber(row.totalBaseCredit),
      sortValue: (row) => toNumber(row.totalBaseCredit),
      exportValue: (row) => row.totalBaseCredit,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={documentStatusTone(row.statusCode)} dot>
          {formatJournalStatus(row.statusCode)}
        </StatusChip>
      ),
      sortValue: (row) => row.statusCode,
      exportValue: (row) => row.statusCode,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="General Ledger"
      title="Journal entries, from draft to posted to reversed."
      description="Every ledger movement lives here. Drafts stay editable until they post; posted entries are immutable and can only be corrected by reversal."
      actions={
        canCreate ? (
          <Button onClick={() => navigate({ to: '/finance/journals/new' })}>
            New journal entry
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Entries',
          value: entriesQuery.isLoading ? '—' : String(rows.length),
          hint: 'In the current filter window',
          tone: 'red',
        },
        {
          label: 'Drafts',
          value: entriesQuery.isLoading ? '—' : String(draftCount),
          hint: 'Awaiting review and posting',
          tone: 'accent',
        },
        {
          label: 'Posted value',
          value: entriesQuery.isLoading ? '—' : formatNumber(totalPostedDebit),
          hint: `${postedCount} posted entries (base debit)`,
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Entry register"
        description="Filter by lifecycle state, journal, and date. Click an entry to open its voucher."
      >
        <FilterBar className="mb-4">
          <FilterTabs
            tabs={STATUS_TABS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search entry #, reference, memo…"
            className="max-w-xs"
          />
          <FilterSelect
            label="Journal type"
            value={typeFilter}
            onChange={setTypeFilter}
            allLabel="All journals"
            options={(typesQuery.data ?? []).map((type) => ({
              value: type.id,
              label: type.name,
            }))}
          />
          <input
            type="date"
            aria-label="From date"
            className={filterSelectClassName}
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <input
            type="date"
            aria-label="To date"
            className={filterSelectClassName}
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(row) => row.id}
          isLoading={entriesQuery.isLoading}
          isError={entriesQuery.isError}
          errorMessage="Could not load journal entries."
          emptyTitle="No journal entries"
          emptyDescription="No entries match the current filters. Create the first entry to start the ledger."
          emptyChildren={
            canCreate ? (
              <Button onClick={() => navigate({ to: '/finance/journals/new' })}>
                New journal entry
              </Button>
            ) : undefined
          }
          onRowClick={(row) =>
            navigate({
              to: '/finance/journals/$entryId',
              params: { entryId: row.id },
            })
          }
          pageSize={25}
          enableColumnVisibility
          exportFileName="journal-entries"
        />
      </WorkspacePanel>
    </WorkspacePage>
  )
}
