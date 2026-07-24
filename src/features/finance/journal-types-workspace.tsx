'use client'

import * as React from 'react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterSearch } from '#/components/data/filter-bar'
import {
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import type { JournalTypeRow } from '#/features/finance/use-fin-journals'
import { useJournalTypes } from '#/features/finance/use-fin-journals'

// Read-only registry of journal types (daybooks). Types are system-seeded —
// tenant-defined types arrive with the posting-automation phase.

export function FinanceJournalTypesWorkspace() {
  const [search, setSearch] = React.useState('')
  const typesQuery = useJournalTypes()

  const rows = React.useMemo(() => typesQuery.data ?? [], [typesQuery.data])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = React.useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }
    return rows.filter(
      (row) =>
        row.code.toLowerCase().includes(normalizedSearch) ||
        row.name.toLowerCase().includes(normalizedSearch),
    )
  }, [rows, normalizedSearch])

  const columns: Array<DataTableColumn<JournalTypeRow>> = [
    {
      id: 'code',
      header: 'Code',
      alwaysVisible: true,
      cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
      sortValue: (row) => row.code,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: 'nameAr',
      header: 'Arabic Name',
      defaultHidden: true,
      cell: (row) => (
        <span dir="rtl" className="text-sm">
          {row.nameAr ?? '—'}
        </span>
      ),
      sortValue: (row) => row.nameAr ?? '',
      exportValue: (row) => row.nameAr ?? '',
    },
    {
      id: 'documentType',
      header: 'Document Type',
      cell: (row) => row.documentType,
      sortValue: (row) => row.documentType,
    },
    {
      id: 'prefix',
      header: 'Number Prefix',
      cell: (row) => row.defaultPrefix ?? '—',
      sortValue: (row) => row.defaultPrefix ?? '',
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: (row) => (
        <StatusChip tone={row.tenantId ? 'primary' : 'neutral'}>
          {row.tenantId ? 'tenant' : 'system'}
        </StatusChip>
      ),
      sortValue: (row) => (row.tenantId ? 'tenant' : 'system'),
      exportValue: (row) => (row.tenantId ? 'tenant' : 'system'),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 'active' : 'inactive'),
      exportValue: (row) => (row.isActive ? 'active' : 'inactive'),
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="General Ledger"
      title="Journal types route every entry into the right daybook."
      description="Each type carries its own document numbering and sorting. Manual entries default to the general journal; automated postings pick their type from posting rules."
      metrics={[
        {
          label: 'Journal types',
          value: typesQuery.isLoading ? '—' : String(rows.length),
          hint: 'System and tenant daybooks',
          tone: 'red',
        },
        {
          label: 'Active',
          value: typesQuery.isLoading
            ? '—'
            : String(rows.filter((row) => row.isActive).length),
          hint: 'Available for new entries',
          tone: 'accent',
        },
        {
          label: 'Tenant-defined',
          value: typesQuery.isLoading
            ? '—'
            : String(rows.filter((row) => row.tenantId).length),
          hint: 'Custom daybooks for this workspace',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Registry"
        title="Journal types"
        description="Types are managed by the finance foundation seed. Custom type management arrives with the posting-automation phase."
      >
        <FilterBar className="mb-4">
          <FilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search code or name…"
            className="max-w-xs"
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(row) => row.id}
          isLoading={typesQuery.isLoading}
          isError={typesQuery.isError}
          errorMessage="Could not load journal types."
          emptyTitle="No journal types"
          emptyDescription="Journal types are seeded when finance is initialized for this workspace."
          enableColumnVisibility
          exportFileName="journal-types"
        />
      </WorkspacePanel>
    </WorkspacePage>
  )
}
