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
import {
  useLeaveMutations,
  useLeaveRequests,
  useLeaveTypes,
} from '#/features/hr/use-leave'
import { leaveRequestSchema } from '#/features/hr/leave-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.leave_view']
const REQUEST = ['hr.leave_request']
const APPROVE = ['hr.leave_approve']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type LeaveRequestRow = NonNullable<
  ReturnType<typeof useLeaveRequests>['data']
>[number]

const STATUS_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info'
> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

function LeaveRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [leaveTypeId, setLeaveTypeId] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [isHalfDay, setIsHalfDay] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const employeesQuery = useEmployees()
  const typesQuery = useLeaveTypes()
  const { submitRequest } = useLeaveMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setLeaveTypeId('')
      setStartDate('')
      setEndDate('')
      setIsHalfDay(false)
      setReason('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = leaveRequestSchema.safeParse({
      employeeId,
      leaveTypeId,
      startDate,
      endDate: endDate || startDate,
      isHalfDay,
      reason: reason.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await submitRequest.mutateAsync(parsed.data)
      notifySuccess('Leave requested', 'Sent for approval.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not submit the leave request')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New leave request</DialogTitle>
          <DialogDescription>
            Paid leave is checked against the employee's available balance
            before submission.
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
          <Field label="Leave type">
            <select
              className={selectClassName}
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
            >
              <option value="">Select a type…</option>
              {(typesQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="End date">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isHalfDay}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isHalfDay}
              onChange={(e) => setIsHalfDay(e.target.checked)}
            />
            Half day
          </label>
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
            <Button type="submit" disabled={submitRequest.isPending}>
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LeaveWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canRequest = can(REQUEST)
  const canApprove = can(APPROVE)
  const [dialog, setDialog] = React.useState(false)

  const requestsQuery = useLeaveRequests()
  const typesQuery = useLeaveTypes()
  const employeesQuery = useEmployees()
  const { decideRequest, cancelRequest } = useLeaveMutations()

  const rows = requestsQuery.data ?? []
  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }
  const typeName = (id: string) =>
    (typesQuery.data ?? []).find((t) => t.id === id)?.name ?? '—'

  async function decide(id: string, decision: 'approved' | 'rejected') {
    try {
      await decideRequest.mutateAsync({ id, decision })
      notifySuccess(`Leave ${decision}`, '')
    } catch (e: unknown) {
      notifyError(e, 'Could not record the decision')
    }
  }

  const columns: DataTableColumn<LeaveRequestRow>[] = [
    {
      id: 'number',
      header: 'Request',
      cell: (r) => <span className="font-mono text-xs">{r.requestNumber}</span>,
      sortValue: (r) => r.requestNumber,
    },
    {
      id: 'employee',
      header: 'Employee',
      alwaysVisible: true,
      cell: (r) => empName(r.employeeId),
      sortValue: (r) => empName(r.employeeId),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (r) => typeName(r.leaveTypeId),
      sortValue: (r) => typeName(r.leaveTypeId),
    },
    {
      id: 'dates',
      header: 'Dates',
      cell: (r) =>
        `${new Date(r.startDate).toLocaleDateString()} → ${new Date(r.endDate).toLocaleDateString()}`,
      sortValue: (r) => new Date(r.startDate).getTime(),
    },
    {
      id: 'days',
      header: 'Days',
      align: 'end',
      cell: (r) => r.totalDays,
      sortValue: (r) => Number(r.totalDays),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={STATUS_TONES[r.statusCode] ?? 'neutral'}>
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
        r.statusCode === 'submitted' ? (
          <div className="flex justify-end gap-1.5">
            {canApprove ? (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => decide(r.id, 'approved')}
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={() => decide(r.id, 'rejected')}
                >
                  Reject
                </Button>
              </>
            ) : null}
            {canRequest ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={async () => {
                  try {
                    await cancelRequest.mutateAsync(r.id)
                    notifySuccess('Cancelled', '')
                  } catch (e: unknown) {
                    notifyError(e, 'Could not cancel')
                  }
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ]

  const pending = rows.filter((r) => r.statusCode === 'submitted').length
  const approved = rows.filter((r) => r.statusCode === 'approved').length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Leave"
      title="Track time off from request to approval."
      description="Leave requests hold days against the employee's balance on submission and settle on approval. Managers and HR approve or reject from here."
      actions={
        canRequest ? (
          <Button onClick={() => setDialog(true)}>New request</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Pending',
          value: requestsQuery.isLoading ? '—' : String(pending),
          hint: 'Awaiting decision',
          tone: 'red',
        },
        {
          label: 'Approved',
          value: requestsQuery.isLoading ? '—' : String(approved),
          hint: 'This list',
          tone: 'accent',
        },
        {
          label: 'Leave types',
          value: typesQuery.isLoading
            ? '—'
            : String((typesQuery.data ?? []).length),
          hint: 'Configured',
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
            description="Ask for the 'View Leave' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Requests"
          title="Leave requests"
          description="Submitted requests can be approved or rejected."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={requestsQuery.isLoading}
            isError={requestsQuery.isError}
            emptyTitle="No leave requests"
            emptyDescription="Submit a request to get started."
            emptyChildren={
              canRequest ? (
                <Button onClick={() => setDialog(true)}>New request</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-leave-requests"
          />
        </WorkspacePanel>
      </AccessGuard>
      <LeaveRequestDialog open={dialog} onOpenChange={setDialog} />
    </WorkspacePage>
  )
}
