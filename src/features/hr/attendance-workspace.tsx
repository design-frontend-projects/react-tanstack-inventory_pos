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
  useAttendanceMutations,
  useDailyAttendance,
  useOvertime,
  useShifts,
} from '#/features/hr/use-attendance'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.attendance_view']
const MANAGE = ['hr.attendance_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type DailyRow = NonNullable<
  ReturnType<typeof useDailyAttendance>['data']
>[number]
type OvertimeRow = NonNullable<ReturnType<typeof useOvertime>['data']>[number]

function PunchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [shiftId, setShiftId] = React.useState('')
  const [direction, setDirection] = React.useState<'in' | 'out'>('in')
  const [eventTime, setEventTime] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const employeesQuery = useEmployees()
  const shiftsQuery = useShifts()
  const { recordPunch } = useAttendanceMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setShiftId('')
      setDirection('in')
      setEventTime('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!employeeId || !eventTime) {
      setError('Employee and time are required.')
      return
    }
    try {
      await recordPunch.mutateAsync({
        employeeId,
        direction,
        eventTime: new Date(eventTime),
        captureMethod: 'manual',
        shiftId: shiftId || null,
      })
      notifySuccess(
        'Punch recorded',
        `${direction === 'in' ? 'Clock-in' : 'Clock-out'} saved.`,
      )
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not record the punch')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record attendance</DialogTitle>
          <DialogDescription>
            A punch recalculates that day's worked hours, lateness, and overtime
            against the shift.
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
            <Field label="Direction">
              <select
                className={selectClassName}
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
              >
                <option value="in">Clock in</option>
                <option value="out">Clock out</option>
              </select>
            </Field>
            <Field label="Shift (optional)">
              <select
                className={selectClassName}
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
              >
                <option value="">—</option>
                {(shiftsQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Time">
            <Input
              type="datetime-local"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
            />
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
            <Button type="submit" disabled={recordPunch.isPending}>
              Save punch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AttendanceWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [dialog, setDialog] = React.useState(false)

  const dailyQuery = useDailyAttendance()
  const overtimeQuery = useOvertime()
  const shiftsQuery = useShifts()
  const employeesQuery = useEmployees()
  const { decideOvertime } = useAttendanceMutations()

  const daily = dailyQuery.data ?? []
  const overtime = overtimeQuery.data ?? []
  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  const dailyColumns: DataTableColumn<DailyRow>[] = [
    {
      id: 'date',
      header: 'Date',
      alwaysVisible: true,
      cell: (r) => new Date(r.workDate).toLocaleDateString(),
      sortValue: (r) => new Date(r.workDate).getTime(),
    },
    {
      id: 'employee',
      header: 'Employee',
      cell: (r) => empName(r.employeeId),
      sortValue: (r) => empName(r.employeeId),
    },
    {
      id: 'in',
      header: 'In',
      cell: (r) => (r.firstIn ? new Date(r.firstIn).toLocaleTimeString() : '—'),
      sortValue: (r) => (r.firstIn ? new Date(r.firstIn).getTime() : 0),
    },
    {
      id: 'out',
      header: 'Out',
      cell: (r) => (r.lastOut ? new Date(r.lastOut).toLocaleTimeString() : '—'),
      sortValue: (r) => (r.lastOut ? new Date(r.lastOut).getTime() : 0),
    },
    {
      id: 'worked',
      header: 'Worked',
      align: 'end',
      cell: (r) => `${r.workedHours}h`,
      sortValue: (r) => Number(r.workedHours),
    },
    {
      id: 'late',
      header: 'Late',
      align: 'end',
      cell: (r) => `${r.lateMinutes}m`,
      sortValue: (r) => r.lateMinutes,
    },
    {
      id: 'ot',
      header: 'OT',
      align: 'end',
      cell: (r) => `${r.overtimeHours}h`,
      sortValue: (r) => Number(r.overtimeHours),
    },
    {
      id: 'code',
      header: 'Status',
      cell: (r) => (
        <StatusChip
          tone={
            r.attendanceCode === 'absent'
              ? 'danger'
              : r.attendanceCode === 'late'
                ? 'warning'
                : 'success'
          }
        >
          {r.attendanceCode}
        </StatusChip>
      ),
      sortValue: (r) => r.attendanceCode,
    },
  ]

  const overtimeColumns: DataTableColumn<OvertimeRow>[] = [
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
      id: 'date',
      header: 'Date',
      cell: (r) => new Date(r.overtimeDate).toLocaleDateString(),
      sortValue: (r) => new Date(r.overtimeDate).getTime(),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      cell: (r) => `${r.hours} × ${r.rateMultiplier}`,
      sortValue: (r) => Number(r.hours),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip
          tone={
            r.statusCode === 'approved'
              ? 'success'
              : r.statusCode === 'rejected'
                ? 'danger'
                : 'warning'
          }
        >
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
        canManage && r.statusCode === 'submitted' ? (
          <div className="flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={async () => {
                try {
                  await decideOvertime.mutateAsync({
                    id: r.id,
                    decision: 'approved',
                  })
                  notifySuccess('Overtime approved', '')
                } catch (e: unknown) {
                  notifyError(e, 'Failed')
                }
              }}
            >
              Approve
            </Button>
            <Button
              size="xs"
              variant="destructive"
              onClick={async () => {
                try {
                  await decideOvertime.mutateAsync({
                    id: r.id,
                    decision: 'rejected',
                  })
                  notifySuccess('Overtime rejected', '')
                } catch (e: unknown) {
                  notifyError(e, 'Failed')
                }
              }}
            >
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Time & Attendance"
      title="From punches to payroll-ready daily attendance."
      description="Record clock-ins and clock-outs; the system computes worked hours, lateness, and overtime per shift. Overtime requests route to managers for approval."
      actions={
        canManage ? (
          <Button onClick={() => setDialog(true)}>Record punch</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Daily records',
          value: dailyQuery.isLoading ? '—' : String(daily.length),
          hint: 'Recent days',
          tone: 'red',
        },
        {
          label: 'Shifts',
          value: shiftsQuery.isLoading
            ? '—'
            : String((shiftsQuery.data ?? []).length),
          hint: 'Configured',
          tone: 'accent',
        },
        {
          label: 'Pending OT',
          value: overtimeQuery.isLoading
            ? '—'
            : String(
                overtime.filter((o) => o.statusCode === 'submitted').length,
              ),
          hint: 'Awaiting approval',
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
            description="Ask for the 'View Attendance' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Daily"
          title="Daily attendance"
          description="Calculated from raw punches against the assigned shift."
        >
          <DataTable
            columns={dailyColumns}
            rows={daily}
            rowKey={(r) => r.id}
            isLoading={dailyQuery.isLoading}
            isError={dailyQuery.isError}
            emptyTitle="No attendance yet"
            emptyDescription="Record a punch to generate daily attendance."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setDialog(true)}>Record punch</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-attendance-daily"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Overtime"
          title="Overtime requests"
          description="Approved overtime flows into payroll."
        >
          <DataTable
            columns={overtimeColumns}
            rows={overtime}
            rowKey={(r) => r.id}
            isLoading={overtimeQuery.isLoading}
            isError={overtimeQuery.isError}
            emptyTitle="No overtime requests"
            emptyDescription="Overtime submitted by employees appears here."
            pageSize={10}
            exportFileName="hr-overtime"
          />
        </WorkspacePanel>
      </AccessGuard>
      <PunchDialog open={dialog} onOpenChange={setDialog} />
    </WorkspacePage>
  )
}
