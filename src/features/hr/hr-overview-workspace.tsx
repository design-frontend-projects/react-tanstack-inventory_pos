'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useDepartments, usePositions } from '#/features/hr/use-organization'
import { useEmployees } from '#/features/hr/use-employees'

const VIEW = ['hr.analytics_view']

type QuickLink = {
  to:
    | '/hr/organization'
    | '/hr/departments'
    | '/hr/positions'
    | '/hr/job-grades'
    | '/hr/cost-centers'
    | '/hr/employees'
  label: string
  description: string
}

const QUICK_LINKS: QuickLink[] = [
  {
    to: '/hr/employees',
    label: 'Employees',
    description: 'Directory, profiles, and timelines',
  },
  {
    to: '/hr/organization',
    label: 'Organization',
    description: 'Companies and branches',
  },
  { to: '/hr/departments', label: 'Departments', description: 'Org hierarchy' },
  { to: '/hr/positions', label: 'Positions', description: 'Jobs and grades' },
  { to: '/hr/job-grades', label: 'Job grades', description: 'Salary bands' },
  {
    to: '/hr/cost-centers',
    label: 'Cost centers',
    description: 'HR cost pools',
  },
]

export function HrOverviewWorkspace() {
  const { permissions, roles } = usePermissions()
  const employeesQuery = useEmployees()
  const departmentsQuery = useDepartments()
  const positionsQuery = usePositions()

  const employees = employeesQuery.data?.items ?? []
  const totalEmployees = employeesQuery.data?.total ?? 0
  const activeCount = employees.filter(
    (e) => e.employmentStatus === 'active',
  ).length
  const onLeave = employees.filter(
    (e) => e.employmentStatus === 'on_leave',
  ).length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Human Resources"
      title="Your workforce at a glance."
      description="A control room for the HCM module. Headcount, structure, and quick access to every HR surface."
      metrics={[
        {
          label: 'Headcount',
          value: employeesQuery.isLoading ? '—' : String(totalEmployees),
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
          hint: 'On this page',
          tone: 'neutral',
        },
        {
          label: 'Departments',
          value: departmentsQuery.isLoading
            ? '—'
            : String((departmentsQuery.data ?? []).length),
          hint: 'Org units',
          tone: 'red',
        },
        {
          label: 'Positions',
          value: positionsQuery.isLoading
            ? '—'
            : String((positionsQuery.data ?? []).length),
          hint: 'Defined roles',
          tone: 'accent',
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
          eyebrow="Navigate"
          title="HR workspaces"
          description="Jump into any area of the HCM module."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
              >
                <div className="text-sm font-semibold group-hover:text-primary">
                  {link.label}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Coming soon"
          title="Recruitment, time, leave & payroll"
          description="These HCM domains are designed in spec 007 and ship in later phases on this same foundation."
        >
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {[
              'Recruitment (ATS)',
              'Onboarding',
              'Time & attendance',
              'Leave',
              'Payroll',
              'Benefits',
              'Performance',
              'Training',
              'Travel & expense',
              'HR analytics',
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-muted/50 px-3 py-1"
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-4">
            <Link to="/hr/employees">
              <Button variant="outline">Go to employees</Button>
            </Link>
          </div>
        </WorkspacePanel>
      </AccessGuard>
    </WorkspacePage>
  )
}
