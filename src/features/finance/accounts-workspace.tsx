'use client'

import * as React from 'react'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  FilterTabs,
} from '#/components/data/filter-bar'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { usePermissions } from '#/features/auth/use-permissions'
import { AccountFormDrawer } from '#/features/finance/account-form-drawer'
import type { FinAccountRow } from '#/features/finance/use-fin-accounts'
import {
  useFinAccountMutations,
  useFinAccountTypes,
  useFinAccounts,
} from '#/features/finance/use-fin-accounts'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const MANAGE_PERMISSIONS = ['finance.account_manage']

type AccountNode = {
  row: FinAccountRow
  children: Array<AccountNode>
}

const ROOT_KEY = '__root__'

// Flat account list → parent/children tree. Orphaned parents (filtered out by
// search/type filters) surface their children at the root instead of hiding them.
function buildAccountTree(rows: Array<FinAccountRow>): Array<AccountNode> {
  const ids = new Set(rows.map((row) => row.id))
  const byParent = new Map<string, Array<FinAccountRow>>()

  for (const row of rows) {
    const key =
      row.parentAccountId && ids.has(row.parentAccountId)
        ? row.parentAccountId
        : ROOT_KEY
    byParent.set(key, [...(byParent.get(key) ?? []), row])
  }

  const sortRows = (list: Array<FinAccountRow>) =>
    [...list].sort((a, b) => a.code.localeCompare(b.code))

  const toNode = (row: FinAccountRow): AccountNode => ({
    row,
    children: sortRows(byParent.get(row.id) ?? []).map(toNode),
  })

  return sortRows(byParent.get(ROOT_KEY) ?? []).map(toNode)
}

function AccountBadges({ row }: { row: FinAccountRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
        {row.isActive ? 'active' : 'inactive'}
      </StatusChip>
      {row.isControlAccount ? (
        <StatusChip tone="info">
          control{row.controlDomain ? `: ${row.controlDomain}` : ''}
        </StatusChip>
      ) : null}
      {!row.allowManualJournal ? (
        <StatusChip tone="warning">no manual</StatusChip>
      ) : null}
      {row.currencyCode ? (
        <StatusChip tone="primary">{row.currencyCode}</StatusChip>
      ) : null}
    </span>
  )
}

function AccountTreeRows({
  nodes,
  depth,
  collapsedIds,
  onToggle,
  canManage,
  onEdit,
  onAddChild,
  onDeactivate,
}: {
  nodes: Array<AccountNode>
  depth: number
  collapsedIds: ReadonlySet<string>
  onToggle: (id: string) => void
  canManage: boolean
  onEdit: (row: FinAccountRow) => void
  onAddChild: (row: FinAccountRow) => void
  onDeactivate: (row: FinAccountRow) => void
}) {
  return (
    <>
      {nodes.map((node) => {
        const { row, children } = node
        const hasChildren = children.length > 0
        const isCollapsed = collapsedIds.has(row.id)

        return (
          <React.Fragment key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0">
              <div
                className="flex min-w-0 items-center gap-2"
                style={{ paddingInlineStart: `${depth * 1.25}rem` }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    aria-expanded={!isCollapsed}
                    onClick={() => onToggle(row.id)}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRightIcon className="size-4 rtl:rotate-180" />
                    ) : (
                      <ChevronDownIcon className="size-4" />
                    )}
                  </button>
                ) : (
                  <span aria-hidden className="inline-block size-6 shrink-0" />
                )}
                <span className="font-mono text-xs text-muted-foreground">
                  {row.code}
                </span>
                <span className="truncate font-medium">{row.name}</span>
                <span className="hidden text-xs text-muted-foreground lg:inline">
                  {row.accountType.name}
                </span>
                <AccountBadges row={row} />
              </div>

              {canManage ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => onEdit(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => onAddChild(row)}
                  >
                    Add child
                  </Button>
                  {row.isActive ? (
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => onDeactivate(row)}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {hasChildren && !isCollapsed ? (
              <AccountTreeRows
                nodes={children}
                depth={depth + 1}
                collapsedIds={collapsedIds}
                onToggle={onToggle}
                canManage={canManage}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onDeactivate={onDeactivate}
              />
            ) : null}
          </React.Fragment>
        )
      })}
    </>
  )
}

export function FinanceAccountsWorkspace() {
  const { can } = usePermissions()
  const canManage = can(MANAGE_PERMISSIONS)

  const [view, setView] = React.useState('tree')
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('active')
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FinAccountRow | null>(null)
  const [parentForNew, setParentForNew] = React.useState<string | null>(null)
  const [pendingDeactivate, setPendingDeactivate] =
    React.useState<FinAccountRow | null>(null)

  const accountsQuery = useFinAccounts({
    ...(statusFilter === 'active' ? { isActive: true } : {}),
    ...(statusFilter === 'inactive' ? { isActive: false } : {}),
    ...(typeFilter ? { accountTypeId: typeFilter } : {}),
  })
  const typesQuery = useFinAccountTypes()
  const { deactivateAccount } = useFinAccountMutations()

  const rows = React.useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  )
  const accountTypes = React.useMemo(
    () => typesQuery.data ?? [],
    [typesQuery.data],
  )

  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = React.useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }
    return rows.filter(
      (row) =>
        row.code.toLowerCase().includes(normalizedSearch) ||
        row.name.toLowerCase().includes(normalizedSearch) ||
        (row.nameAr ?? '').toLowerCase().includes(normalizedSearch),
    )
  }, [rows, normalizedSearch])

  const tree = React.useMemo(
    () => buildAccountTree(filteredRows),
    [filteredRows],
  )
  const nameById = React.useMemo(
    () => new Map(rows.map((row) => [row.id, `${row.code} — ${row.name}`])),
    [rows],
  )

  const activeCount = rows.filter((row) => row.isActive).length
  const postableCount = rows.filter(
    (row) => row.isLeaf && row.allowManualJournal && row.isActive,
  ).length
  const controlCount = rows.filter((row) => row.isControlAccount).length

  const openCreate = (parentId: string | null = null) => {
    setEditing(null)
    setParentForNew(parentId)
    setDrawerOpen(true)
  }

  const openEdit = (row: FinAccountRow) => {
    setEditing(row)
    setParentForNew(null)
    setDrawerOpen(true)
  }

  const toggleNode = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const tableRows = React.useMemo(
    () => [...filteredRows].sort((a, b) => a.path.localeCompare(b.path)),
    [filteredRows],
  )

  const columns: Array<DataTableColumn<FinAccountRow>> = [
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
      id: 'type',
      header: 'Type',
      cell: (row) => row.accountType.name,
      sortValue: (row) => row.accountType.name,
    },
    {
      id: 'class',
      header: 'Class',
      cell: (row) => row.accountType.accountClass.name,
      sortValue: (row) => row.accountType.accountClass.name,
    },
    {
      id: 'parent',
      header: 'Parent',
      defaultHidden: true,
      cell: (row) =>
        row.parentAccountId
          ? (nameById.get(row.parentAccountId) ?? '—')
          : 'Top level',
      sortValue: (row) =>
        row.parentAccountId ? (nameById.get(row.parentAccountId) ?? '') : '',
    },
    {
      id: 'currency',
      header: 'Currency',
      cell: (row) => row.currencyCode ?? 'Any',
      sortValue: (row) => row.currencyCode ?? '',
    },
    {
      id: 'level',
      header: 'Level',
      align: 'end',
      defaultHidden: true,
      cell: (row) => row.level,
      sortValue: (row) => row.level,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <AccountBadges row={row} />,
      sortValue: (row) => (row.isActive ? 'active' : 'inactive'),
      exportValue: (row) => (row.isActive ? 'active' : 'inactive'),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (row) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1.5">
            <Button size="xs" variant="outline" onClick={() => openEdit(row)}>
              Edit
            </Button>
            {row.isActive ? (
              <Button
                size="xs"
                variant="destructive"
                onClick={() => setPendingDeactivate(row)}
              >
                Deactivate
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="General Ledger"
      title="Chart of accounts, structured for clean postings and reporting."
      description="The account hierarchy behind every journal, subledger, and report. Summary accounts group; leaf accounts post. Control accounts stay reserved for their subledgers."
      actions={
        canManage ? (
          <Button onClick={() => openCreate()}>New account</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Accounts',
          value: accountsQuery.isLoading ? '—' : String(rows.length),
          hint: `${activeCount} active`,
          tone: 'red',
        },
        {
          label: 'Postable',
          value: accountsQuery.isLoading ? '—' : String(postableCount),
          hint: 'Active leaves open to manual journals',
          tone: 'accent',
        },
        {
          label: 'Control accounts',
          value: accountsQuery.isLoading ? '—' : String(controlCount),
          hint: 'Subledger-reserved balances',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Hierarchy"
        title="Account tree"
        description="Browse the hierarchy, or switch to a flat table with search, column selection, and CSV export."
      >
        <FilterBar className="mb-4">
          <FilterTabs
            tabs={[
              { value: 'tree', label: 'Tree' },
              { value: 'table', label: 'Table' },
            ]}
            value={view}
            onChange={setView}
          />
          <FilterSearch
            value={search}
            onChange={setSearch}
            placeholder="Search code or name…"
            className="max-w-xs"
          />
          <FilterSelect
            label="Account type"
            value={typeFilter}
            onChange={setTypeFilter}
            allLabel="All types"
            options={accountTypes.map((type) => ({
              value: type.id,
              label: type.name,
            }))}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            includeAll={false}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'all', label: 'All statuses' },
            ]}
          />
        </FilterBar>

        {view === 'tree' ? (
          accountsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading accounts…</p>
          ) : accountsQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load the chart of accounts"
              description="Check your connection and permissions, then retry."
            />
          ) : tree.length === 0 ? (
            <WorkspaceEmptyState
              title="No accounts yet"
              description="Initialize finance from Financial Settings to seed the default chart, or create accounts manually."
            >
              {canManage ? (
                <Button onClick={() => openCreate()}>Create account</Button>
              ) : null}
            </WorkspaceEmptyState>
          ) : (
            <div className="text-sm">
              <AccountTreeRows
                nodes={tree}
                depth={0}
                collapsedIds={collapsedIds}
                onToggle={toggleNode}
                canManage={canManage}
                onEdit={openEdit}
                onAddChild={(row) => openCreate(row.id)}
                onDeactivate={setPendingDeactivate}
              />
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            rows={tableRows}
            rowKey={(row) => row.id}
            isLoading={accountsQuery.isLoading}
            isError={accountsQuery.isError}
            errorMessage="Could not load the chart of accounts."
            emptyTitle="No accounts found"
            emptyDescription="No accounts match the current filters."
            pageSize={25}
            enableColumnVisibility
            exportFileName="chart-of-accounts"
          />
        )}
      </WorkspacePanel>

      <AccountFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        account={editing}
        defaultParentId={parentForNew}
        accounts={rows}
        accountTypes={accountTypes}
      />

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeactivate(null)
          }
        }}
        title="Deactivate account?"
        description={
          pendingDeactivate
            ? `"${pendingDeactivate.code} — ${pendingDeactivate.name}" will stop accepting postings. History and balances are preserved.`
            : undefined
        }
        confirmLabel="Deactivate"
        tone="destructive"
        isPending={deactivateAccount.isPending}
        onConfirm={async () => {
          if (!pendingDeactivate) {
            return
          }
          try {
            await deactivateAccount.mutateAsync(pendingDeactivate.id)
            notifySuccess(
              'Account deactivated',
              `${pendingDeactivate.code} — ${pendingDeactivate.name} is now inactive.`,
            )
            setPendingDeactivate(null)
          } catch (error: unknown) {
            notifyError(error, 'Could not deactivate the account')
          }
        }}
      />
    </WorkspacePage>
  )
}
