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
import { useJobGrades, usePositions } from '#/features/hr/use-organization'
import {
  useCareerMutations,
  useCareerPaths,
  usePromotions,
  useSuccessors,
} from '#/features/hr/use-career'
import { promotionCreateSchema } from '#/features/hr/career-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.employee_view']
const MANAGE = ['hr.employee_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type CareerPathRow = NonNullable<
  ReturnType<typeof useCareerPaths>['data']
>[number]
type SuccessorRow = NonNullable<
  ReturnType<typeof useSuccessors>['data']
>[number]
type PromotionRow = NonNullable<
  ReturnType<typeof usePromotions>['data']
>[number]

const PROMOTION_TONES: Partial<
  Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'>
> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

const READINESS_TONES: Partial<
  Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'>
> = {
  ready_now: 'success',
  ready_soon: 'info',
  developing: 'warning',
  long_term: 'neutral',
}

function PromotionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [toPositionId, setToPositionId] = React.useState('')
  const [toJobGradeId, setToJobGradeId] = React.useState('')
  const [newSalary, setNewSalary] = React.useState('')
  const [effectiveDate, setEffectiveDate] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const employeesQuery = useEmployees()
  const positionsQuery = usePositions()
  const jobGradesQuery = useJobGrades()
  const { createPromotion } = useCareerMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setToPositionId('')
      setToJobGradeId('')
      setNewSalary('')
      setEffectiveDate('')
      setReason('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = promotionCreateSchema.safeParse({
      employeeId,
      toPositionId: toPositionId || null,
      toJobGradeId: toJobGradeId || null,
      newSalary: newSalary.trim() || null,
      effectiveDate: effectiveDate || null,
      reason: reason.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createPromotion.mutateAsync(parsed.data)
      notifySuccess('Promotion drafted', 'Approve it to apply the change.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the promotion')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New promotion</DialogTitle>
          <DialogDescription>
            A promotion is drafted first; approving it moves the employee onto
            the target position and grade.
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
            <Field label="To position">
              <select
                className={selectClassName}
                value={toPositionId}
                onChange={(e) => setToPositionId(e.target.value)}
              >
                <option value="">—</option>
                {(positionsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To job grade">
              <select
                className={selectClassName}
                value={toJobGradeId}
                onChange={(e) => setToJobGradeId(e.target.value)}
              >
                <option value="">—</option>
                {(jobGradesQuery.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New salary">
              <Input
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
              />
            </Field>
            <Field label="Effective date">
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
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
            <Button type="submit" disabled={createPromotion.isPending}>
              Draft promotion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CareerWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [dialog, setDialog] = React.useState(false)

  const pathsQuery = useCareerPaths()
  const successorsQuery = useSuccessors()
  const promotionsQuery = usePromotions()
  const employeesQuery = useEmployees()
  const positionsQuery = usePositions()
  const { approvePromotion } = useCareerMutations()

  const paths = pathsQuery.data ?? []
  const successors = successorsQuery.data ?? []
  const promotions = promotionsQuery.data ?? []

  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }
  const positionTitle = (id: string | null) =>
    id
      ? ((positionsQuery.data ?? []).find((p) => p.id === id)?.title ?? '—')
      : '—'

  async function approve(id: string) {
    try {
      await approvePromotion.mutateAsync(id)
      notifySuccess(
        'Promotion approved',
        'Employee moved to the target position.',
      )
    } catch (e: unknown) {
      notifyError(e, 'Could not approve the promotion')
    }
  }

  const pathColumns: DataTableColumn<CareerPathRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Path',
      alwaysVisible: true,
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    {
      id: 'from',
      header: 'From',
      cell: (r) => positionTitle(r.fromPositionId),
      sortValue: (r) => positionTitle(r.fromPositionId),
    },
    {
      id: 'to',
      header: 'To',
      cell: (r) => positionTitle(r.toPositionId),
      sortValue: (r) => positionTitle(r.toPositionId),
    },
    {
      id: 'minYears',
      header: 'Min years',
      align: 'end',
      cell: (r) => r.minYears ?? '—',
      sortValue: (r) => Number(r.minYears ?? 0),
    },
  ]

  const successorColumns: DataTableColumn<SuccessorRow>[] = [
    {
      id: 'position',
      header: 'Position',
      alwaysVisible: true,
      cell: (r) => positionTitle(r.positionId),
      sortValue: (r) => positionTitle(r.positionId),
    },
    {
      id: 'employee',
      header: 'Successor',
      cell: (r) => empName(r.employeeId),
      sortValue: (r) => empName(r.employeeId),
    },
    {
      id: 'readiness',
      header: 'Readiness',
      cell: (r) => (
        <StatusChip tone={READINESS_TONES[r.readinessLevel] ?? 'neutral'}>
          {r.readinessLevel}
        </StatusChip>
      ),
      sortValue: (r) => r.readinessLevel,
    },
    {
      id: 'priority',
      header: 'Priority',
      align: 'end',
      cell: (r) => r.priority,
      sortValue: (r) => r.priority,
    },
  ]

  const promotionColumns: DataTableColumn<PromotionRow>[] = [
    {
      id: 'number',
      header: 'Promotion',
      cell: (r) => (
        <span className="font-mono text-xs">{r.promotionNumber}</span>
      ),
      sortValue: (r) => r.promotionNumber,
    },
    {
      id: 'employee',
      header: 'Employee',
      alwaysVisible: true,
      cell: (r) => empName(r.employeeId),
      sortValue: (r) => empName(r.employeeId),
    },
    {
      id: 'to',
      header: 'To position',
      cell: (r) => positionTitle(r.toPositionId),
      sortValue: (r) => positionTitle(r.toPositionId),
    },
    {
      id: 'effective',
      header: 'Effective',
      cell: (r) =>
        r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '—',
      sortValue: (r) =>
        r.effectiveDate ? new Date(r.effectiveDate).getTime() : 0,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={PROMOTION_TONES[r.statusCode] ?? 'neutral'}>
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
        canManage &&
        (r.statusCode === 'draft' || r.statusCode === 'submitted') ? (
          <div className="flex justify-end">
            <Button size="xs" variant="outline" onClick={() => approve(r.id)}>
              Approve
            </Button>
          </div>
        ) : null,
    },
  ]

  const pending = promotions.filter(
    (r) => r.statusCode === 'draft' || r.statusCode === 'submitted',
  ).length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Career"
      title="Plan progression, succession, and promotions."
      description="Define career paths between positions, nominate successors for critical roles, and process promotions that move employees onto new positions and grades."
      actions={
        canManage ? (
          <Button onClick={() => setDialog(true)}>New promotion</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Career paths',
          value: pathsQuery.isLoading ? '—' : String(paths.length),
          hint: 'Defined',
          tone: 'accent',
        },
        {
          label: 'Successors',
          value: successorsQuery.isLoading ? '—' : String(successors.length),
          hint: 'Nominated',
          tone: 'neutral',
        },
        {
          label: 'Pending',
          value: promotionsQuery.isLoading ? '—' : String(pending),
          hint: 'Promotions',
          tone: 'red',
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
          eyebrow="Progression"
          title="Career paths"
          description="Position-to-position progression routes."
        >
          <DataTable
            columns={pathColumns}
            rows={paths}
            rowKey={(r) => r.id}
            isLoading={pathsQuery.isLoading}
            isError={pathsQuery.isError}
            emptyTitle="No career paths"
            emptyDescription="Define paths to map progression between positions."
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-career-paths"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Succession"
          title="Successors"
          description="Nominated successors per critical position."
        >
          <DataTable
            columns={successorColumns}
            rows={successors}
            rowKey={(r) => r.id}
            isLoading={successorsQuery.isLoading}
            isError={successorsQuery.isError}
            emptyTitle="No successors"
            emptyDescription="Nominate employees as successors for key positions."
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-successors"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Promotions"
          title="Promotions"
          description="Draft promotions can be approved to apply the change."
        >
          <DataTable
            columns={promotionColumns}
            rows={promotions}
            rowKey={(r) => r.id}
            isLoading={promotionsQuery.isLoading}
            isError={promotionsQuery.isError}
            emptyTitle="No promotions"
            emptyDescription="Draft a promotion to move an employee to a new role."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setDialog(true)}>New promotion</Button>
              ) : null
            }
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-promotions"
          />
        </WorkspacePanel>
      </AccessGuard>
      <PromotionDialog open={dialog} onOpenChange={setDialog} />
    </WorkspacePage>
  )
}
