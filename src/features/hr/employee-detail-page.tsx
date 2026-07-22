'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { StatusChip } from '#/components/board/status-chip'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import { useEmployee } from '#/features/hr/use-employees'

const VIEW = ['hr.employee_view']

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  )
}

export function EmployeeDetailPage({ employeeId }: { employeeId: string }) {
  const { permissions, roles } = usePermissions()
  const query = useEmployee(employeeId)
  const employee = query.data

  if (query.isLoading) {
    return (
      <WorkspacePage
        variant="compact"
        eyebrow="Employee"
        title="Loading profile…"
        description="Fetching the employee record."
      >
        <WorkspacePanel
          eyebrow="Profile"
          title="Employee"
          description="Please wait…"
        >
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        </WorkspacePanel>
      </WorkspacePage>
    )
  }

  if (query.isError || !employee) {
    return (
      <WorkspacePage
        variant="compact"
        eyebrow="Employee"
        title="Employee not found"
        description="This employee does not exist or you lack access."
      >
        <WorkspaceEmptyState
          title="Employee unavailable"
          description="The record may have been archived."
          children={
            <Link to="/hr/employees">
              <Button variant="outline">Back to employees</Button>
            </Link>
          }
        />
      </WorkspacePage>
    )
  }

  const fullName = `${employee.firstName} ${employee.lastName}`

  return (
    <WorkspacePage
      variant="compact"
      eyebrow={`Employee · ${employee.employeeCode}`}
      title={fullName}
      description="Master profile, employment details, and the full employment timeline. History is append-only — every change is preserved."
      actions={
        <Link to="/hr/employees">
          <Button variant="outline">Back to directory</Button>
        </Link>
      }
      metrics={[
        {
          label: 'Status',
          value: employee.employmentStatus,
          hint: 'Employment status',
          tone: 'red',
        },
        {
          label: 'Type',
          value: employee.employmentType,
          hint: 'Employment type',
          tone: 'accent',
        },
        {
          label: 'Hired',
          value: formatDate(employee.hireDate),
          hint: 'Join date',
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
        <div className="grid gap-4 lg:grid-cols-2">
          <WorkspacePanel
            eyebrow="Personal"
            title="Personal information"
            description="Identity and contact details."
          >
            <div className="px-1">
              <DetailRow label="Full name" value={fullName} />
              <DetailRow
                label="Arabic name"
                value={[employee.firstNameAr, employee.lastNameAr]
                  .filter(Boolean)
                  .join(' ')}
              />
              <DetailRow label="Gender" value={employee.gender} />
              <DetailRow
                label="Date of birth"
                value={formatDate(employee.dateOfBirth)}
              />
              <DetailRow label="Nationality" value={employee.nationality} />
              <DetailRow label="National ID" value={employee.nationalId} />
              <DetailRow label="Work email" value={employee.workEmail} />
              <DetailRow label="Work phone" value={employee.workPhone} />
            </div>
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="Employment"
            title="Employment details"
            description="Placement in the organization."
          >
            <div className="px-1">
              <DetailRow label="Employee code" value={employee.employeeCode} />
              <DetailRow
                label="Status"
                value={
                  <StatusChip tone="info">
                    {employee.employmentStatus}
                  </StatusChip>
                }
              />
              <DetailRow label="Type" value={employee.employmentType} />
              <DetailRow
                label="Hire date"
                value={formatDate(employee.hireDate)}
              />
              <DetailRow
                label="Probation ends"
                value={formatDate(employee.probationEndDate)}
              />
              <DetailRow
                label="Confirmation"
                value={formatDate(employee.confirmationDate)}
              />
              <DetailRow label="Work location" value={employee.workLocation} />
              <DetailRow
                label="Contracts on file"
                value={String(employee.contracts.length)}
              />
            </div>
          </WorkspacePanel>
        </div>

        <WorkspacePanel
          eyebrow="Timeline"
          title="Employment history"
          description="Append-only record of every change — the single source of truth for the employment timeline."
        >
          {employee.history.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No history recorded yet.
            </div>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {employee.history.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">
                      {entry.changeType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(entry.effectiveDate)}
                    </span>
                  </div>
                  {entry.fieldName ? (
                    <p className="text-xs text-muted-foreground">
                      {entry.fieldName}: {entry.oldValue ?? '—'} →{' '}
                      {entry.newValue ?? '—'}
                    </p>
                  ) : null}
                  {entry.reason ? (
                    <p className="text-xs text-muted-foreground">
                      {entry.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </WorkspacePanel>
      </AccessGuard>
    </WorkspacePage>
  )
}
