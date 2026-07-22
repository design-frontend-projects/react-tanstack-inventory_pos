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
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useDepartments } from '#/features/hr/use-organization'
import { useEmployees } from '#/features/hr/use-employees'
import { useLeaveRequests } from '#/features/hr/use-leave'
import { usePayrollRuns } from '#/features/hr/use-payroll'

const VIEW = ['hr.analytics_view']

type DeptStat = { id: string; name: string; headcount: number; active: number }

export function HrAnalyticsWorkspace() {
  const { permissions, roles } = usePermissions()
  const employeesQuery = useEmployees()
  const departmentsQuery = useDepartments()
  const leaveQuery = useLeaveRequests()
  const runsQuery = usePayrollRuns()

  const employees = employeesQuery.data?.items ?? []
  const departments = departmentsQuery.data ?? []
  const leave = leaveQuery.data ?? []
  const runs = runsQuery.data ?? []

  const totalHeadcount = employeesQuery.data?.total ?? employees.length
  const activeCount = employees.filter(
    (e) => e.employmentStatus === 'active',
  ).length
  const onLeave = employees.filter(
    (e) => e.employmentStatus === 'on_leave',
  ).length
  const probation = employees.filter(
    (e) => e.employmentStatus === 'probation',
  ).length
  const pendingLeave = leave.filter((l) => l.statusCode === 'submitted').length
  const postedNet = runs
    .filter((r) => ['posted', 'paid'].includes(r.statusCode))
    .reduce((s, r) => s + Number(r.totalNet), 0)

  const deptStats: DeptStat[] = React.useMemo(() => {
    return departments
      .map((d) => {
        const inDept = employees.filter((e) => e.departmentId === d.id)
        return {
          id: d.id,
          name: d.name,
          headcount: inDept.length,
          active: inDept.filter((e) => e.employmentStatus === 'active').length,
        }
      })
      .filter((d) => d.headcount > 0)
      .sort((a, b) => b.headcount - a.headcount)
  }, [departments, employees])

  const leaveByStatus = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const l of leave)
      map.set(l.statusCode, (map.get(l.statusCode) ?? 0) + 1)
    return Array.from(map.entries()).map(([status, count]) => ({
      status,
      count,
    }))
  }, [leave])

  const deptColumns: DataTableColumn<DeptStat>[] = [
    {
      id: 'name',
      header: 'Department',
      alwaysVisible: true,
      cell: (r) => <span className="font-medium">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      id: 'headcount',
      header: 'Headcount',
      align: 'end',
      cell: (r) => r.headcount,
      sortValue: (r) => r.headcount,
    },
    {
      id: 'active',
      header: 'Active',
      align: 'end',
      cell: (r) => r.active,
      sortValue: (r) => r.active,
    },
    {
      id: 'share',
      header: 'Share',
      align: 'end',
      cell: (r) =>
        `${totalHeadcount ? Math.round((r.headcount / totalHeadcount) * 100) : 0}%`,
      sortValue: (r) => r.headcount,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="HR Analytics"
      title="Workforce metrics at a glance."
      description="Headcount, structure, leave, and payroll signals across the organization. Deeper turnover, retention, and recruitment funnels build on these aggregates."
      metrics={[
        {
          label: 'Headcount',
          value: employeesQuery.isLoading ? '—' : String(totalHeadcount),
          hint: 'Total employees',
          tone: 'red',
        },
        {
          label: 'Active',
          value: employeesQuery.isLoading ? '—' : String(activeCount),
          hint: 'Currently active',
          tone: 'accent',
        },
        {
          label: 'On leave',
          value: employeesQuery.isLoading ? '—' : String(onLeave),
          hint: 'Away',
          tone: 'neutral',
        },
        {
          label: 'Probation',
          value: employeesQuery.isLoading ? '—' : String(probation),
          hint: 'In probation',
          tone: 'red',
        },
        {
          label: 'Pending leave',
          value: leaveQuery.isLoading ? '—' : String(pendingLeave),
          hint: 'Awaiting approval',
          tone: 'accent',
        },
        {
          label: 'Posted payroll',
          value: runsQuery.isLoading ? '—' : postedNet.toFixed(0),
          hint: 'Net posted/paid',
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
            description="Ask for the 'View HR Analytics' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Structure"
          title="Headcount by department"
          description="Distribution of staff across the organization."
        >
          <DataTable
            columns={deptColumns}
            rows={deptStats}
            rowKey={(r) => r.id}
            isLoading={employeesQuery.isLoading || departmentsQuery.isLoading}
            emptyTitle="No department data"
            emptyDescription="Assign employees to departments to see the breakdown."
            pageSize={15}
            exportFileName="hr-headcount-by-department"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Leave"
          title="Leave requests by status"
          description="Current leave pipeline."
        >
          {leaveByStatus.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No leave requests yet.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {leaveByStatus.map((item) => (
                <div
                  key={item.status}
                  className="rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="text-2xl font-semibold">{item.count}</div>
                  <StatusChip tone="neutral">{item.status}</StatusChip>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </AccessGuard>
    </WorkspacePage>
  )
}
