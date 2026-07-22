'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
} from '#/components/data/filter-bar'
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
import {
  useDepartments,
  useJobGrades,
  usePositions,
} from '#/features/hr/use-organization'
import { useEmployeeMutations, useEmployees } from '#/features/hr/use-employees'
import { employeeCreateSchema } from '#/features/hr/validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.employee_view']
const MANAGE = ['hr.employee_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type EmployeeRow = NonNullable<
  ReturnType<typeof useEmployees>['data']
>['items'][number]

const STATUS_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  active: 'success',
  probation: 'warning',
  on_leave: 'warning',
  suspended: 'danger',
  terminated: 'neutral',
}

function EmployeeCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [employeeCode, setEmployeeCode] = React.useState('')
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [workEmail, setWorkEmail] = React.useState('')
  const [departmentId, setDepartmentId] = React.useState('')
  const [positionId, setPositionId] = React.useState('')
  const [jobGradeId, setJobGradeId] = React.useState('')
  const [employmentType, setEmploymentType] = React.useState('full_time')
  const [hireDate, setHireDate] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const departmentsQuery = useDepartments()
  const positionsQuery = usePositions()
  const jobGradesQuery = useJobGrades()
  const { createEmployee } = useEmployeeMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeCode('')
      setFirstName('')
      setLastName('')
      setWorkEmail('')
      setDepartmentId('')
      setPositionId('')
      setJobGradeId('')
      setEmploymentType('full_time')
      setHireDate('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = employeeCreateSchema.safeParse({
      employeeCode: employeeCode.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      workEmail: workEmail.trim() || null,
      departmentId: departmentId || null,
      positionId: positionId || null,
      jobGradeId: jobGradeId || null,
      employmentType,
      hireDate: hireDate || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createEmployee.mutateAsync(parsed.data)
      notifySuccess('Employee created', `${firstName} ${lastName}`)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the employee')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New employee</DialogTitle>
          <DialogDescription>
            Create the core employee record. Additional details are edited from
            the profile.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee code">
              <Input
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
              />
            </Field>
            <Field label="Employment type">
              <select
                className={selectClassName}
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
                <option value="intern">Intern</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Work email">
            <Input
              type="email"
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select
                className={selectClassName}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">—</option>
                {(departmentsQuery.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Position">
              <select
                className={selectClassName}
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
              >
                <option value="">—</option>
                {(positionsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Job grade">
              <select
                className={selectClassName}
                value={jobGradeId}
                onChange={(e) => setJobGradeId(e.target.value)}
              >
                <option value="">—</option>
                {(jobGradesQuery.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hire date">
              <Input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </Field>
          </div>
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
            <Button type="submit" disabled={createEmployee.isPending}>
              Create employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EmployeeWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [dialog, setDialog] = React.useState(false)

  const departmentsQuery = useDepartments()
  const query = useEmployees({
    search: search.trim() || undefined,
    employmentStatus: status || undefined,
  })
  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const deptName = (id: string | null) =>
    (departmentsQuery.data ?? []).find((d) => d.id === id)?.name ?? '—'

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.employeeCode}</span>,
      sortValue: (r) => r.employeeCode,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (r) => (
        <Link
          to="/hr/employees/$employeeId"
          params={{ employeeId: r.id }}
          className="font-medium text-primary hover:underline"
        >
          {r.firstName} {r.lastName}
        </Link>
      ),
      sortValue: (r) => `${r.lastName} ${r.firstName}`,
    },
    {
      id: 'department',
      header: 'Department',
      cell: (r) => deptName(r.departmentId),
      sortValue: (r) => deptName(r.departmentId),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (r) => r.employmentType,
      sortValue: (r) => r.employmentType,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={STATUS_TONES[r.employmentStatus] ?? 'neutral'}>
          {r.employmentStatus}
        </StatusChip>
      ),
      sortValue: (r) => r.employmentStatus,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) => (
        <Link to="/hr/employees/$employeeId" params={{ employeeId: r.id }}>
          <Button size="xs" variant="outline">
            Open
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="People"
      title="The people directory for your organization."
      description="Employee master data drives payroll, attendance, leave, and performance. Open a profile to manage contracts, documents, and the employment timeline."
      actions={
        canManage ? (
          <Button onClick={() => setDialog(true)}>New employee</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Employees',
          value: query.isLoading ? '—' : String(total),
          hint: 'Matching filters',
          tone: 'red',
        },
        {
          label: 'Active',
          value: query.isLoading
            ? '—'
            : String(
                items.filter((r) => r.employmentStatus === 'active').length,
              ),
          hint: 'On this page',
          tone: 'accent',
        },
        {
          label: 'On leave',
          value: query.isLoading
            ? '—'
            : String(
                items.filter((r) => r.employmentStatus === 'on_leave').length,
              ),
          hint: 'On this page',
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
          eyebrow="Directory"
          title="Employees"
          description="Search by name, code, or email; filter by status."
        >
          <FilterBar className="mb-4">
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search employees…"
              className="max-w-xs"
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="All statuses"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'probation', label: 'Probation' },
                { value: 'on_leave', label: 'On leave' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'terminated', label: 'Terminated' },
              ]}
            />
          </FilterBar>
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            isLoading={query.isLoading}
            isError={query.isError}
            emptyTitle="No employees yet"
            emptyDescription="Create your first employee to build the directory."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setDialog(true)}>Create employee</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-employees"
          />
        </WorkspacePanel>
      </AccessGuard>
      <EmployeeCreateDialog open={dialog} onOpenChange={setDialog} />
    </WorkspacePage>
  )
}
