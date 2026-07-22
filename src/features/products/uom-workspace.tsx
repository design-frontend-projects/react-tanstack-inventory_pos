'use client'

import * as React from 'react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterSearch } from '#/components/data/filter-bar'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { UomFormDialog } from '#/features/products/master-data-dialogs'
import type { UomFormValues } from '#/features/products/master-data-dialogs'
import { useUoms } from '#/features/products/use-master-data'

const VIEW_PERMISSIONS = ['product.view']
const MANAGE_PERMISSIONS = ['product.manage_categories']

// No delete server function exists for units (they anchor conversions and
// stock quantities), so this workspace offers create/edit plus deactivation
// via the edit dialog's Active toggle.

type UomRow = NonNullable<ReturnType<typeof useUoms>['data']>[number]

function toFormValues(row: UomRow): UomFormValues {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    uomType: row.uomType,
    isBaseUnit: row.isBaseUnit,
    decimalPlaces: row.decimalPlaces,
    isActive: row.isActive,
  }
}

export function UomWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE_PERMISSIONS)

  const [search, setSearch] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UomFormValues | null>(null)

  const uomsQuery = useUoms()

  const rows = React.useMemo(() => uomsQuery.data ?? [], [uomsQuery.data])
  const activeCount = rows.filter((row) => row.isActive).length
  const baseUnitCount = rows.filter((row) => row.isBaseUnit).length

  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = React.useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.code.toLowerCase().includes(normalizedSearch) ||
        (row.symbol ?? '').toLowerCase().includes(normalizedSearch),
    )
  }, [rows, normalizedSearch])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (row: UomRow) => {
    setEditing(toFormValues(row))
    setDialogOpen(true)
  }

  const columns: DataTableColumn<UomRow>[] = [
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
      cell: (row) => (
        <span className="font-medium">
          {row.name}
          {row.symbol ? (
            <span className="ml-1 text-xs text-muted-foreground">
              ({row.symbol})
            </span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <span className="lowercase">{row.uomType}</span>,
      sortValue: (row) => row.uomType,
    },
    {
      id: 'decimals',
      header: 'Decimals',
      align: 'end',
      cell: (row) => row.decimalPlaces,
      sortValue: (row) => row.decimalPlaces,
    },
    {
      id: 'base',
      header: 'Base unit',
      cell: (row) =>
        row.isBaseUnit ? <StatusChip tone="primary">base</StatusChip> : '—',
      sortValue: (row) => (row.isBaseUnit ? 'base' : ''),
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
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (row) =>
        canManage ? (
          <Button size="xs" variant="outline" onClick={() => openEdit(row)}>
            Edit
          </Button>
        ) : null,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Units of measure"
      title="Define the units that quantities are counted, bought, and sold in."
      description="Units drive every quantity across purchasing, stock, and sales. Base units anchor conversions; decimal places control rounding on documents."
      actions={
        canManage ? <Button onClick={openCreate}>New unit</Button> : null
      }
      metrics={[
        {
          label: 'Units',
          value: uomsQuery.isLoading ? '—' : String(rows.length),
          hint: 'Registered in this workspace',
          tone: 'red',
        },
        {
          label: 'Active',
          value: uomsQuery.isLoading ? '—' : String(activeCount),
          hint: 'Selectable on products and documents',
          tone: 'accent',
        },
        {
          label: 'Base units',
          value: uomsQuery.isLoading ? '—' : String(baseUnitCount),
          hint: 'Anchors for conversion factors',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Register"
        title="Unit master"
        description="Search by code, name, or symbol. Units cannot be deleted — deactivate them from the edit dialog instead."
      >
        <AccessGuard
          permissions={VIEW_PERMISSIONS}
          userRoles={roles}
          userPermissions={permissions}
          fallback={
            <WorkspaceEmptyState
              title="You don't have access to units"
              description="Ask an administrator for the 'View Products' permission to open the unit register."
            />
          }
        >
          <FilterBar className="mb-4">
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search units…"
              className="max-w-xs"
            />
          </FilterBar>

          <DataTable
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.id}
            isLoading={uomsQuery.isLoading}
            isError={uomsQuery.isError}
            errorMessage="Could not load units. Check your connection and permissions, then retry."
            emptyTitle="No units yet"
            emptyDescription="Create units of measure before registering products."
            emptyChildren={
              canManage ? (
                <Button onClick={openCreate}>Create unit</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="units-of-measure"
          />
        </AccessGuard>
      </WorkspacePanel>

      <UomFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        uom={editing}
      />
    </WorkspacePage>
  )
}
