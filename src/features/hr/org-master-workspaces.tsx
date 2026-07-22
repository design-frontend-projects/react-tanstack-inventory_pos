'use client'

import * as React from 'react'
import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  CostCenterDialog,
  DepartmentDialog,
  JobGradeDialog,
  PositionDialog,
} from '#/features/hr/hr-dialogs'
import type {
  CostCenterFormValues,
  DepartmentFormValues,
  JobGradeFormValues,
  PositionFormValues,
} from '#/features/hr/hr-dialogs'
import {
  useCostCenters,
  useDepartments,
  useJobGrades,
  useOrganizationMutations,
  usePositions,
} from '#/features/hr/use-organization'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.org_view']
const MANAGE = ['hr.org_manage']

// --- Departments ------------------------------------------------------------

type DepartmentRow = NonNullable<
  ReturnType<typeof useDepartments>['data']
>[number]

export function DepartmentWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const query = useDepartments()
  const { department: mut } = useOrganizationMutations()
  const [dialog, setDialog] = React.useState(false)
  const [editing, setEditing] = React.useState<DepartmentFormValues | null>(
    null,
  )
  const [pending, setPending] = React.useState<DepartmentRow | null>(null)
  const rows = query.data ?? []
  const nameById = (id: string | null) =>
    rows.find((d) => d.id === id)?.name ?? '—'

  const columns: DataTableColumn<DepartmentRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (r) => (
        <span
          className="font-medium"
          style={{ paddingLeft: `${r.depthLevel * 14}px` }}
        >
          {r.name}
        </span>
      ),
      sortValue: (r) => r.pathText ?? r.name,
    },
    {
      id: 'parent',
      header: 'Parent',
      cell: (r) => nameById(r.parentDepartmentId),
      sortValue: (r) => nameById(r.parentDepartmentId),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={r.isActive ? 'success' : 'neutral'}>
          {r.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (r) => (r.isActive ? 'a' : 'z'),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing({
                  id: r.id,
                  companyId: r.companyId,
                  parentDepartmentId: r.parentDepartmentId,
                  code: r.code,
                  name: r.name,
                  isActive: r.isActive,
                })
                setDialog(true)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => setPending(r)}
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
      eyebrow="Organization"
      title="Structure departments into a clear reporting hierarchy."
      description="Departments nest under a parent to form the org tree. Cycles are rejected and depth is maintained automatically."
      actions={
        canManage ? (
          <Button
            onClick={() => {
              setEditing(null)
              setDialog(true)
            }}
          >
            New department
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Departments',
          value: query.isLoading ? '—' : String(rows.length),
          hint: 'In this tenant',
          tone: 'red',
        },
        {
          label: 'Top level',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => !r.parentDepartmentId).length),
          hint: 'Root departments',
          tone: 'accent',
        },
        {
          label: 'Max depth',
          value: query.isLoading
            ? '—'
            : String(rows.reduce((m, r) => Math.max(m, r.depthLevel), 0)),
          hint: 'Hierarchy levels',
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
            description="Ask for the 'View Organization' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Hierarchy"
          title="Department tree"
          description="Indentation reflects the reporting depth."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={query.isLoading}
            isError={query.isError}
            emptyTitle="No departments yet"
            emptyDescription="Create departments to build the org tree."
            emptyChildren={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setDialog(true)
                  }}
                >
                  Create department
                </Button>
              ) : null
            }
            pageSize={25}
            exportFileName="hr-departments"
          />
        </WorkspacePanel>
      </AccessGuard>
      <DepartmentDialog
        open={dialog}
        onOpenChange={setDialog}
        department={editing}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
        title="Delete department?"
        description={
          pending ? `"${pending.name}" will be archived.` : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={mut.remove.isPending}
        onConfirm={async () => {
          if (!pending) return
          try {
            await mut.remove.mutateAsync(pending.id)
            notifySuccess('Department deleted', pending.name)
            setPending(null)
          } catch (e: unknown) {
            notifyError(e, 'Could not delete')
          }
        }}
      />
    </WorkspacePage>
  )
}

// --- Positions --------------------------------------------------------------

type PositionRow = NonNullable<ReturnType<typeof usePositions>['data']>[number]

export function PositionWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const query = usePositions()
  const gradesQuery = useJobGrades()
  const { position: mut } = useOrganizationMutations()
  const [dialog, setDialog] = React.useState(false)
  const [editing, setEditing] = React.useState<PositionFormValues | null>(null)
  const [pending, setPending] = React.useState<PositionRow | null>(null)
  const rows = query.data ?? []
  const gradeName = (id: string | null) =>
    (gradesQuery.data ?? []).find((g) => g.id === id)?.name ?? '—'

  const columns: DataTableColumn<PositionRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'title',
      header: 'Title',
      alwaysVisible: true,
      cell: (r) => <span className="font-medium">{r.title}</span>,
      sortValue: (r) => r.title,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (r) => r.employmentType,
      sortValue: (r) => r.employmentType,
    },
    {
      id: 'grade',
      header: 'Grade',
      cell: (r) => gradeName(r.jobGradeId),
      sortValue: (r) => gradeName(r.jobGradeId),
    },
    {
      id: 'managerial',
      header: 'Managerial',
      cell: (r) => (r.isManagerial ? 'Yes' : 'No'),
      sortValue: (r) => (r.isManagerial ? 'a' : 'z'),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing({
                  id: r.id,
                  code: r.code,
                  title: r.title,
                  departmentId: r.departmentId,
                  jobGradeId: r.jobGradeId,
                  employmentType: r.employmentType,
                  isManagerial: r.isManagerial,
                  isActive: r.isActive,
                })
                setDialog(true)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => setPending(r)}
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
      eyebrow="Organization"
      title="Define the positions employees are hired into."
      description="Positions link to a department and job grade and can be marked managerial for the reporting hierarchy."
      actions={
        canManage ? (
          <Button
            onClick={() => {
              setEditing(null)
              setDialog(true)
            }}
          >
            New position
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Positions',
          value: query.isLoading ? '—' : String(rows.length),
          hint: 'Defined roles',
          tone: 'red',
        },
        {
          label: 'Managerial',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => r.isManagerial).length),
          hint: 'Lead positions',
          tone: 'accent',
        },
        {
          label: 'Active',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => r.isActive).length),
          hint: 'Open to staffing',
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
            description="Ask for the 'View Organization' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Roles"
          title="Positions"
          description="Job positions and their grade mapping."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={query.isLoading}
            isError={query.isError}
            emptyTitle="No positions yet"
            emptyDescription="Create positions to staff employees into."
            emptyChildren={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setDialog(true)
                  }}
                >
                  Create position
                </Button>
              ) : null
            }
            pageSize={25}
            exportFileName="hr-positions"
          />
        </WorkspacePanel>
      </AccessGuard>
      <PositionDialog
        open={dialog}
        onOpenChange={setDialog}
        position={editing}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
        title="Delete position?"
        description={
          pending ? `"${pending.title}" will be archived.` : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={mut.remove.isPending}
        onConfirm={async () => {
          if (!pending) return
          try {
            await mut.remove.mutateAsync(pending.id)
            notifySuccess('Position deleted', pending.title)
            setPending(null)
          } catch (e: unknown) {
            notifyError(e, 'Could not delete')
          }
        }}
      />
    </WorkspacePage>
  )
}

// --- Job grades -------------------------------------------------------------

type JobGradeRow = NonNullable<ReturnType<typeof useJobGrades>['data']>[number]

export function JobGradeWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const query = useJobGrades()
  const { jobGrade: mut } = useOrganizationMutations()
  const [dialog, setDialog] = React.useState(false)
  const [editing, setEditing] = React.useState<JobGradeFormValues | null>(null)
  const [pending, setPending] = React.useState<JobGradeRow | null>(null)
  const rows = query.data ?? []

  const columns: DataTableColumn<JobGradeRow>[] = [
    {
      id: 'level',
      header: 'Level',
      cell: (r) => r.gradeLevel,
      sortValue: (r) => r.gradeLevel,
    },
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      id: 'band',
      header: 'Salary band',
      cell: (r) =>
        `${r.minSalary ?? '—'} – ${r.maxSalary ?? '—'} ${r.currencyCode}`,
      sortValue: (r) => Number(r.minSalary ?? 0),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing({
                  id: r.id,
                  code: r.code,
                  name: r.name,
                  gradeLevel: r.gradeLevel,
                  minSalary: r.minSalary,
                  maxSalary: r.maxSalary,
                  currencyCode: r.currencyCode,
                  isActive: r.isActive,
                })
                setDialog(true)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => setPending(r)}
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
      eyebrow="Organization"
      title="Grade salary bands and leave entitlements."
      description="Job grades set the min/mid/max salary range and drive default leave entitlements for positions."
      actions={
        canManage ? (
          <Button
            onClick={() => {
              setEditing(null)
              setDialog(true)
            }}
          >
            New job grade
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Grades',
          value: query.isLoading ? '—' : String(rows.length),
          hint: 'Salary bands',
          tone: 'red',
        },
        {
          label: 'Levels',
          value: query.isLoading
            ? '—'
            : String(new Set(rows.map((r) => r.gradeLevel)).size),
          hint: 'Distinct levels',
          tone: 'accent',
        },
        {
          label: 'Active',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => r.isActive).length),
          hint: 'In use',
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
            description="Ask for the 'View Organization' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Compensation"
          title="Job grades"
          description="Ordered by grade level."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={query.isLoading}
            isError={query.isError}
            emptyTitle="No job grades yet"
            emptyDescription="Create grades to band compensation."
            emptyChildren={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setDialog(true)
                  }}
                >
                  Create job grade
                </Button>
              ) : null
            }
            pageSize={25}
            exportFileName="hr-job-grades"
          />
        </WorkspacePanel>
      </AccessGuard>
      <JobGradeDialog
        open={dialog}
        onOpenChange={setDialog}
        jobGrade={editing}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
        title="Delete job grade?"
        description={
          pending ? `"${pending.name}" will be archived.` : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={mut.remove.isPending}
        onConfirm={async () => {
          if (!pending) return
          try {
            await mut.remove.mutateAsync(pending.id)
            notifySuccess('Job grade deleted', pending.name)
            setPending(null)
          } catch (e: unknown) {
            notifyError(e, 'Could not delete')
          }
        }}
      />
    </WorkspacePage>
  )
}

// --- Cost centers -----------------------------------------------------------

type CostCenterRow = NonNullable<
  ReturnType<typeof useCostCenters>['data']
>[number]

export function CostCenterWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const query = useCostCenters()
  const { costCenter: mut } = useOrganizationMutations()
  const [dialog, setDialog] = React.useState(false)
  const [editing, setEditing] = React.useState<CostCenterFormValues | null>(
    null,
  )
  const [pending, setPending] = React.useState<CostCenterRow | null>(null)
  const rows = query.data ?? []

  const columns: DataTableColumn<CostCenterRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      id: 'linked',
      header: 'Finance link',
      cell: (r) => (r.finCostCenterId ? 'Linked' : '—'),
      sortValue: (r) => (r.finCostCenterId ? 'a' : 'z'),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={r.isActive ? 'success' : 'neutral'}>
          {r.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (r) => (r.isActive ? 'a' : 'z'),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing({
                  id: r.id,
                  code: r.code,
                  name: r.name,
                  parentId: r.parentId,
                  isActive: r.isActive,
                })
                setDialog(true)
              }}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={() => setPending(r)}
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
      eyebrow="Organization"
      title="Group HR costs and map them to finance."
      description="Cost centers roll up payroll, benefits, and expense costs and link to finance dimensions for GL reporting."
      actions={
        canManage ? (
          <Button
            onClick={() => {
              setEditing(null)
              setDialog(true)
            }}
          >
            New cost center
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Cost centers',
          value: query.isLoading ? '—' : String(rows.length),
          hint: 'Defined',
          tone: 'red',
        },
        {
          label: 'Finance-linked',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => r.finCostCenterId).length),
          hint: 'Mapped to GL',
          tone: 'accent',
        },
        {
          label: 'Active',
          value: query.isLoading
            ? '—'
            : String(rows.filter((r) => r.isActive).length),
          hint: 'In use',
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
            description="Ask for the 'View Organization' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Costing"
          title="Cost centers"
          description="HR cost pools."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={query.isLoading}
            isError={query.isError}
            emptyTitle="No cost centers yet"
            emptyDescription="Create cost centers to allocate HR spend."
            emptyChildren={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setDialog(true)
                  }}
                >
                  Create cost center
                </Button>
              ) : null
            }
            pageSize={25}
            exportFileName="hr-cost-centers"
          />
        </WorkspacePanel>
      </AccessGuard>
      <CostCenterDialog
        open={dialog}
        onOpenChange={setDialog}
        costCenter={editing}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
        title="Delete cost center?"
        description={
          pending ? `"${pending.name}" will be archived.` : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isPending={mut.remove.isPending}
        onConfirm={async () => {
          if (!pending) return
          try {
            await mut.remove.mutateAsync(pending.id)
            notifySuccess('Cost center deleted', pending.name)
            setPending(null)
          } catch (e: unknown) {
            notifyError(e, 'Could not delete')
          }
        }}
      />
    </WorkspacePage>
  )
}
