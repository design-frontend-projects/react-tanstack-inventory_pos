'use client'

import * as React from 'react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterSearch } from '#/components/data/filter-bar'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { BrandFormDialog } from '#/features/products/master-data-dialogs'
import type { BrandFormValues } from '#/features/products/master-data-dialogs'
import {
  useBrands,
  useMasterDataMutations,
} from '#/features/products/use-master-data'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW_PERMISSIONS = ['product.view']
const MANAGE_PERMISSIONS = ['product.manage_categories']

type BrandRow = NonNullable<ReturnType<typeof useBrands>['data']>[number]

function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleDateString()
}

function toFormValues(row: BrandRow): BrandFormValues {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
  }
}

export function BrandWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE_PERMISSIONS)

  const [search, setSearch] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BrandFormValues | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<BrandRow | null>(
    null,
  )

  const brandsQuery = useBrands()
  const { deleteBrand } = useMasterDataMutations()

  const rows = React.useMemo(() => brandsQuery.data ?? [], [brandsQuery.data])
  const activeCount = rows.filter((row) => row.isActive).length

  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = React.useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.code.toLowerCase().includes(normalizedSearch),
    )
  }, [rows, normalizedSearch])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (row: BrandRow) => {
    setEditing(toFormValues(row))
    setDialogOpen(true)
  }

  const columns: DataTableColumn<BrandRow>[] = [
    {
      id: 'code',
      header: 'Code',
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
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 'active' : 'inactive'),
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
      sortValue: (row) => new Date(row.createdAt).getTime(),
      exportValue: (row) => formatDate(row.createdAt),
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
      eyebrow="Brands"
      title="Keep the brand register clean so products group correctly."
      description="Brands tie products to their manufacturer or label. They power catalog filters, purchasing lookups, and reporting rollups."
      actions={
        canManage ? <Button onClick={openCreate}>New brand</Button> : null
      }
      metrics={[
        {
          label: 'Brands',
          value: brandsQuery.isLoading ? '—' : String(rows.length),
          hint: 'Registered in this workspace',
          tone: 'red',
        },
        {
          label: 'Active',
          value: brandsQuery.isLoading ? '—' : String(activeCount),
          hint: 'Selectable on products',
          tone: 'accent',
        },
        {
          label: 'Inactive',
          value: brandsQuery.isLoading
            ? '—'
            : String(rows.length - activeCount),
          hint: 'Hidden from product forms',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Brand master"
        description="Search by code or name. Deleting a brand soft-removes it without touching its products."
      >
        <AccessGuard
          permissions={VIEW_PERMISSIONS}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to brands"
              description="Ask an administrator for the 'View Products' permission to open the brand register."
            />
          }
        >
          <FilterBar className="mb-4">
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search brands…"
              className="max-w-xs"
            />
          </FilterBar>

          <DataTable
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.id}
            isLoading={brandsQuery.isLoading}
            isError={brandsQuery.isError}
            errorMessage="Could not load brands. Check your connection and permissions, then retry."
            emptyTitle="No brands yet"
            emptyDescription="Create brands to group products by label."
            emptyChildren={
              canManage ? (
                <Button onClick={openCreate}>Create brand</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="brands"
          />
        </AccessGuard>
      </WorkspacePanel>

      <BrandFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        brand={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title="Delete brand?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed from the brand register.`
            : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={deleteBrand.isPending}
        onConfirm={async () => {
          if (!pendingDelete) {
            return
          }
          try {
            await deleteBrand.mutateAsync(pendingDelete.id)
            notifySuccess('Brand deleted', `${pendingDelete.name} removed.`)
            setPendingDelete(null)
          } catch (error: unknown) {
            notifyError(error, 'Could not delete the brand')
          }
        }}
      />
    </WorkspacePage>
  )
}
