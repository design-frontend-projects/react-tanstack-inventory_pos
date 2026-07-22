'use client'

import * as React from 'react'
import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { Field } from '#/features/hr/hr-dialogs'
import { useEmployees } from '#/features/hr/use-employees'
import { useAssetMutations, useAssets } from '#/features/hr/use-assets-expense'
import { assetWriteSchema } from '#/features/hr/assets-expense-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.employee_view']
const MANAGE = ['hr.employee_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type AssetRow = NonNullable<ReturnType<typeof useAssets>['data']>[number]

function AssignDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const employeesQuery = useEmployees()
  const { assignAsset } = useAssetMutations()
  const [employeeId, setEmployeeId] = React.useState('')
  const [assetType, setAssetType] = React.useState('laptop')
  const [name, setName] = React.useState('')
  const [serialNumber, setSerialNumber] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setAssetType('laptop')
      setName('')
      setSerialNumber('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = assetWriteSchema.safeParse({
      employeeId,
      assetType,
      name: name.trim(),
      serialNumber: serialNumber.trim() || null,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    try {
      await assignAsset.mutateAsync(parsed.data)
      notifySuccess('Asset assigned', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not assign the asset')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign asset</DialogTitle>
          <DialogDescription>
            Track company assets handed to employees. Returns close the
            assignment.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Employee">
            <select
              className={selectClassName}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select an employee…</option>
              {(employeesQuery.data?.items ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                className={selectClassName}
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
              >
                <option value="laptop">Laptop</option>
                <option value="desktop">Desktop</option>
                <option value="vehicle">Vehicle</option>
                <option value="phone">Phone</option>
                <option value="uniform">Uniform</option>
                <option value="tool">Tool</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Serial number">
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Name / description">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={assignAsset.isPending}>
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AssetsWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [dialog, setDialog] = React.useState(false)
  const query = useAssets()
  const employeesQuery = useEmployees()
  const { returnAsset } = useAssetMutations()
  const rows = query.data ?? []
  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  const columns: DataTableColumn<AssetRow>[] = [
    {
      id: 'name',
      header: 'Asset',
      alwaysVisible: true,
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (r) => r.assetType,
      sortValue: (r) => r.assetType,
    },
    {
      id: 'employee',
      header: 'Assigned to',
      cell: (r) => empName(r.employeeId),
      sortValue: (r) => empName(r.employeeId),
    },
    {
      id: 'serial',
      header: 'Serial',
      cell: (r) => r.serialNumber ?? '—',
      sortValue: (r) => r.serialNumber ?? '',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={r.statusCode === 'assigned' ? 'info' : 'neutral'}>
          {r.statusCode}
        </StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage && r.statusCode === 'assigned' ? (
          <Button
            size="xs"
            variant="outline"
            onClick={async () => {
              try {
                await returnAsset.mutateAsync({ id: r.id })
                notifySuccess('Asset returned', r.name)
              } catch (e: unknown) {
                notifyError(e, 'Could not return')
              }
            }}
          >
            Return
          </Button>
        ) : null,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Assets"
      title="Track company assets in employees' hands."
      description="Laptops, vehicles, phones, and tools assigned to staff — linked to inventory products or fixed assets. Returns close accountability."
      actions={
        canManage ? (
          <Button onClick={() => setDialog(true)}>Assign asset</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Assigned',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => r.statusCode === 'assigned').length),
          hint: 'Currently out',
          tone: 'red',
        },
        {
          label: 'Returned',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => r.statusCode === 'returned').length),
          hint: 'Closed',
          tone: 'accent',
        },
        {
          label: 'Total',
          value: query.isLoading ? '—' : String(rows.length),
          hint: 'All records',
          tone: 'neutral',
        },
      ]}
    >
      <AccessGuard
        permissions={VIEW}
        userRoles={roles}
        userPermissions={permissions}
        fallback={
          <WorkspaceEmptyState
            title="No access"
            description="Ask for the 'View Employees' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Register"
          title="Employee assets"
          description="Assets currently assigned or returned."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={query.isLoading}
            isError={query.isError}
            emptyTitle="No assets assigned"
            emptyDescription="Assign a company asset to an employee."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setDialog(true)}>Assign asset</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-assets"
          />
        </WorkspacePanel>
      </AccessGuard>
      <AssignDialog open={dialog} onOpenChange={setDialog} />
    </WorkspacePage>
  )
}
