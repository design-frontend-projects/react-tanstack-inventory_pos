'use client'

import * as React from 'react'
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  FilterBar,
  FilterSearch,
  FilterTabs,
} from '#/components/data/filter-bar'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { CategoryFormDialog } from '#/features/products/master-data-dialogs'
import type { CategoryFormValues } from '#/features/products/master-data-dialogs'
import {
  useCategories,
  useMasterDataMutations,
} from '#/features/products/use-master-data'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW_PERMISSIONS = ['product.view']
const MANAGE_PERMISSIONS = ['product.manage_categories']

type CategoryRow = NonNullable<ReturnType<typeof useCategories>['data']>[number]

type CategoryNode = {
  row: CategoryRow
  children: CategoryNode[]
}

const ROOT_KEY = '__root__'

// Assemble the parent→children tree from the flat list. Rows whose parent is
// missing from the result set (defensive) surface at the root instead of
// disappearing.
function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const ids = new Set(rows.map((row) => row.id))
  const byParent = new Map<string, CategoryRow[]>()

  for (const row of rows) {
    const key = row.parentId && ids.has(row.parentId) ? row.parentId : ROOT_KEY
    byParent.set(key, [...(byParent.get(key) ?? []), row])
  }

  const sortRows = (list: CategoryRow[]) =>
    [...list].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    )

  const toNode = (row: CategoryRow): CategoryNode => ({
    row,
    children: sortRows(byParent.get(row.id) ?? []).map(toNode),
  })

  return sortRows(byParent.get(ROOT_KEY) ?? []).map(toNode)
}

// Materialized-path ordering so the flat table reads parent-first.
function byPath(a: CategoryRow, b: CategoryRow) {
  return (a.path ?? '').localeCompare(b.path ?? '')
}

function toFormValues(row: CategoryRow): CategoryFormValues {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
  }
}

function ActiveChip({ isActive }: { isActive: boolean }) {
  return (
    <StatusChip tone={isActive ? 'success' : 'neutral'}>
      {isActive ? 'active' : 'inactive'}
    </StatusChip>
  )
}

function CategoryTreeRows({
  nodes,
  collapsedIds,
  onToggle,
  canManage,
  onEdit,
  onAddChild,
  onDelete,
}: {
  nodes: CategoryNode[]
  collapsedIds: ReadonlySet<string>
  onToggle: (id: string) => void
  canManage: boolean
  onEdit: (row: CategoryRow) => void
  onAddChild: (row: CategoryRow) => void
  onDelete: (row: CategoryRow) => void
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
                style={{ paddingInlineStart: `${row.depth * 1.25}rem` }}
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
                      <ChevronRightIcon className="size-4" />
                    ) : (
                      <ChevronDownIcon className="size-4" />
                    )}
                  </button>
                ) : (
                  <span aria-hidden className="inline-block size-6 shrink-0" />
                )}
                <span className="truncate font-medium">{row.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {row.code}
                </span>
                <ActiveChip isActive={row.isActive} />
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
                    title="Opens the create dialog — pick the parent there"
                    onClick={() => onAddChild(row)}
                  >
                    Add child
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => onDelete(row)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>

            {hasChildren && !isCollapsed ? (
              <CategoryTreeRows
                nodes={children}
                collapsedIds={collapsedIds}
                onToggle={onToggle}
                canManage={canManage}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onDelete={onDelete}
              />
            ) : null}
          </React.Fragment>
        )
      })}
    </>
  )
}

export function CategoryWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE_PERMISSIONS)

  const [view, setView] = React.useState('tree')
  const [search, setSearch] = React.useState('')
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CategoryFormValues | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<CategoryRow | null>(
    null,
  )

  const categoriesQuery = useCategories()
  const { deleteCategory } = useMasterDataMutations()

  const rows = React.useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  )
  const tree = React.useMemo(() => buildTree(rows), [rows])
  const nameById = React.useMemo(
    () => new Map(rows.map((row) => [row.id, row.name])),
    [rows],
  )

  const activeCount = rows.filter((row) => row.isActive).length
  const rootCount = rows.filter((row) => row.depth === 0).length
  const maxDepth = rows.reduce((max, row) => Math.max(max, row.depth), 0)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  // CategoryFormDialog has no parent-preselect prop, so "Add child" opens the
  // create dialog and the user picks the parent from its select.
  const openCreateChild = (_parent: CategoryRow) => {
    openCreate()
  }

  const openEdit = (row: CategoryRow) => {
    setEditing(toFormValues(row))
    setDialogOpen(true)
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

  const normalizedSearch = search.trim().toLowerCase()
  const tableRows = React.useMemo(() => {
    const ordered = [...rows].sort(byPath)
    if (!normalizedSearch) {
      return ordered
    }
    return ordered.filter(
      (row) =>
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.code.toLowerCase().includes(normalizedSearch),
    )
  }, [rows, normalizedSearch])

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: 'code',
      header: 'Code',
      cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
      sortValue: (row) => row.code,
    },
    {
      id: 'parent',
      header: 'Parent',
      cell: (row) =>
        row.parentId ? (nameById.get(row.parentId) ?? '—') : 'Top level',
      sortValue: (row) =>
        row.parentId ? (nameById.get(row.parentId) ?? '') : '',
    },
    {
      id: 'depth',
      header: 'Depth',
      align: 'end',
      defaultHidden: true,
      cell: (row) => row.depth,
      sortValue: (row) => row.depth,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <ActiveChip isActive={row.isActive} />,
      sortValue: (row) => (row.isActive ? 'active' : 'inactive'),
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
            <Button
              size="xs"
              variant="destructive"
              onClick={() => setPendingDelete(row)}
            >
              Delete
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Categories"
      title="Shape the category tree that organises the whole catalog."
      description="Categories drive filtering, reporting, and menu grouping. Nest them freely — the hierarchy is materialised so subtree reads stay cheap."
      actions={
        canManage ? <Button onClick={openCreate}>New category</Button> : null
      }
      metrics={[
        {
          label: 'Categories',
          value: categoriesQuery.isLoading ? '—' : String(rows.length),
          hint: `${activeCount} active`,
          tone: 'red',
        },
        {
          label: 'Root categories',
          value: categoriesQuery.isLoading ? '—' : String(rootCount),
          hint: 'Top-level branches',
          tone: 'accent',
        },
        {
          label: 'Max depth',
          value:
            categoriesQuery.isLoading || rows.length === 0
              ? '—'
              : String(maxDepth + 1),
          hint: 'Levels in the deepest branch',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Hierarchy"
        title="Category tree"
        description="Browse the hierarchy or switch to a flat table with search and export."
      >
        <AccessGuard
          permissions={VIEW_PERMISSIONS}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to categories"
              description="Ask an administrator for the 'View Products' permission to open the catalog hierarchy."
            />
          }
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
            {view === 'table' ? (
              <FilterSearch
                value={search}
                onChange={setSearch}
                placeholder="Search by name or code…"
                className="max-w-xs"
              />
            ) : null}
          </FilterBar>

          {view === 'tree' ? (
            categoriesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading categories…
              </p>
            ) : categoriesQuery.isError ? (
              <WorkspaceEmptyState
                title="Could not load categories"
                description="Check your connection and permissions, then retry."
              />
            ) : tree.length === 0 ? (
              <WorkspaceEmptyState
                title="No categories yet"
                description="Create a category tree to organise the catalog."
              >
                {canManage ? (
                  <Button onClick={openCreate}>Create category</Button>
                ) : null}
              </WorkspaceEmptyState>
            ) : (
              <div className="text-sm">
                <CategoryTreeRows
                  nodes={tree}
                  collapsedIds={collapsedIds}
                  onToggle={toggleNode}
                  canManage={canManage}
                  onEdit={openEdit}
                  onAddChild={openCreateChild}
                  onDelete={setPendingDelete}
                />
              </div>
            )
          ) : (
            <DataTable
              columns={columns}
              rows={tableRows}
              rowKey={(row) => row.id}
              isLoading={categoriesQuery.isLoading}
              isError={categoriesQuery.isError}
              errorMessage="Could not load categories. Check your connection and permissions, then retry."
              emptyTitle="No categories found"
              emptyDescription="No categories match the current search."
              pageSize={25}
              enableColumnVisibility
              exportFileName="categories"
            />
          )}
        </AccessGuard>
      </WorkspacePanel>

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title="Delete category?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed from the catalog hierarchy. Child categories keep their rows but lose this parent link.`
            : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={deleteCategory.isPending}
        onConfirm={async () => {
          if (!pendingDelete) {
            return
          }
          try {
            await deleteCategory.mutateAsync(pendingDelete.id)
            notifySuccess('Category deleted', `${pendingDelete.name} removed.`)
            setPendingDelete(null)
          } catch (error: unknown) {
            notifyError(error, 'Could not delete the category')
          }
        }}
      />
    </WorkspacePage>
  )
}
