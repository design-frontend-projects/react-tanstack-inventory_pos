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
import { useDepartments } from '#/features/hr/use-organization'
import {
  useSkills,
  useWorkforceMutations,
  useWorkforcePlans,
} from '#/features/hr/use-workforce'
import {
  skillWriteSchema,
  workforcePlanWriteSchema,
} from '#/features/hr/workforce-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.employee_view']
const MANAGE = ['hr.org_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type SkillRow = NonNullable<ReturnType<typeof useSkills>['data']>[number]
type PlanRow = NonNullable<ReturnType<typeof useWorkforcePlans>['data']>[number]

const PLAN_STATUS_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info'
> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  active: 'success',
  closed: 'neutral',
}

function SkillDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('technical')
  const [error, setError] = React.useState<string | null>(null)
  const { createSkill } = useWorkforceMutations()

  React.useEffect(() => {
    if (open) {
      setCode('')
      setName('')
      setCategory('technical')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = skillWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      category,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createSkill.mutateAsync(parsed.data)
      notifySuccess('Skill created', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the skill')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New skill</DialogTitle>
          <DialogDescription>
            Skills form the catalog used for employee assessments and position
            requirements.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Category">
              <select
                className={selectClassName}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="technical">Technical</option>
                <option value="soft">Soft</option>
                <option value="language">Language</option>
                <option value="certification">Certification</option>
                <option value="leadership">Leadership</option>
              </select>
            </Field>
          </div>
          <Field label="Name">
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
            <Button type="submit" disabled={createSkill.isPending}>
              Create skill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [fiscalYear, setFiscalYear] = React.useState(
    String(new Date().getUTCFullYear()),
  )
  const [departmentId, setDepartmentId] = React.useState('')
  const [currentHeadcount, setCurrentHeadcount] = React.useState('0')
  const [plannedHeadcount, setPlannedHeadcount] = React.useState('0')
  const [error, setError] = React.useState<string | null>(null)
  const departmentsQuery = useDepartments()
  const { createPlan } = useWorkforceMutations()

  React.useEffect(() => {
    if (open) {
      setCode('')
      setName('')
      setFiscalYear(String(new Date().getUTCFullYear()))
      setDepartmentId('')
      setCurrentHeadcount('0')
      setPlannedHeadcount('0')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = workforcePlanWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      fiscalYear: Number(fiscalYear) || new Date().getUTCFullYear(),
      departmentId: departmentId || null,
      currentHeadcount: Number(currentHeadcount) || 0,
      plannedHeadcount: Number(plannedHeadcount) || 0,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createPlan.mutateAsync(parsed.data)
      notifySuccess('Workforce plan created', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the plan')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New workforce plan</DialogTitle>
          <DialogDescription>
            Plans set a planned headcount target against the current headcount
            to reveal the hiring gap.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Fiscal year">
              <Input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Department (optional)">
            <select
              className={selectClassName}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">— All departments —</option>
              {(departmentsQuery.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current headcount">
              <Input
                type="number"
                value={currentHeadcount}
                onChange={(e) => setCurrentHeadcount(e.target.value)}
              />
            </Field>
            <Field label="Planned headcount">
              <Input
                type="number"
                value={plannedHeadcount}
                onChange={(e) => setPlannedHeadcount(e.target.value)}
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
            <Button type="submit" disabled={createPlan.isPending}>
              Create plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WorkforceWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [skillDialog, setSkillDialog] = React.useState(false)
  const [planDialog, setPlanDialog] = React.useState(false)

  const skillsQuery = useSkills()
  const plansQuery = useWorkforcePlans()
  const departmentsQuery = useDepartments()

  const skills = skillsQuery.data ?? []
  const plans = plansQuery.data ?? []
  const deptName = (id: string | null) =>
    id
      ? ((departmentsQuery.data ?? []).find((d) => d.id === id)?.name ?? '—')
      : 'All'

  const gap = (r: PlanRow) =>
    Math.max(r.plannedHeadcount - r.currentHeadcount, 0)
  const totalGap = plans.reduce((sum, r) => sum + gap(r), 0)

  const skillColumns: DataTableColumn<SkillRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Skill',
      alwaysVisible: true,
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (r) => <StatusChip tone="info">{r.category}</StatusChip>,
      sortValue: (r) => r.category,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'end',
      cell: (r) => (
        <StatusChip tone={r.isActive ? 'success' : 'neutral'}>
          {r.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (r) => (r.isActive ? 1 : 0),
    },
  ]

  const planColumns: DataTableColumn<PlanRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Plan',
      alwaysVisible: true,
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    {
      id: 'year',
      header: 'Year',
      cell: (r) => r.fiscalYear,
      sortValue: (r) => r.fiscalYear,
    },
    {
      id: 'department',
      header: 'Department',
      cell: (r) => deptName(r.departmentId),
      sortValue: (r) => deptName(r.departmentId),
    },
    {
      id: 'current',
      header: 'Current',
      align: 'end',
      cell: (r) => r.currentHeadcount,
      sortValue: (r) => r.currentHeadcount,
    },
    {
      id: 'planned',
      header: 'Planned',
      align: 'end',
      cell: (r) => r.plannedHeadcount,
      sortValue: (r) => r.plannedHeadcount,
    },
    {
      id: 'gap',
      header: 'Gap',
      align: 'end',
      alwaysVisible: true,
      cell: (r) => (
        <StatusChip tone={gap(r) > 0 ? 'warning' : 'success'}>
          {gap(r) > 0 ? `+${gap(r)}` : '0'}
        </StatusChip>
      ),
      sortValue: (r) => gap(r),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={PLAN_STATUS_TONES[r.statusCode] ?? 'neutral'}>
          {r.statusCode}
        </StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Workforce"
      title="Plan headcount and the skills behind it."
      description="Maintain the skills catalog and workforce plans. Each plan compares its planned headcount to the current headcount to surface the hiring gap."
      actions={
        canManage ? (
          <Button onClick={() => setPlanDialog(true)}>New plan</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Skills',
          value: skillsQuery.isLoading ? '—' : String(skills.length),
          hint: 'In catalog',
          tone: 'neutral',
        },
        {
          label: 'Plans',
          value: plansQuery.isLoading ? '—' : String(plans.length),
          hint: 'Workforce plans',
          tone: 'accent',
        },
        {
          label: 'Headcount gap',
          value: plansQuery.isLoading ? '—' : String(totalGap),
          hint: 'To hire',
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
          eyebrow="Skills"
          title="Skills catalog"
          description="The master list of skills used across the organization."
        >
          {canManage ? (
            <div className="mb-4 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSkillDialog(true)}
              >
                New skill
              </Button>
            </div>
          ) : null}
          <DataTable
            columns={skillColumns}
            rows={skills}
            rowKey={(r) => r.id}
            isLoading={skillsQuery.isLoading}
            isError={skillsQuery.isError}
            emptyTitle="No skills yet"
            emptyDescription="Add a skill to build the catalog."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setSkillDialog(true)}>New skill</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-skills"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Planning"
          title="Workforce plans"
          description="Planned vs current headcount reveals each plan's hiring gap."
        >
          <DataTable
            columns={planColumns}
            rows={plans}
            rowKey={(r) => r.id}
            isLoading={plansQuery.isLoading}
            isError={plansQuery.isError}
            emptyTitle="No workforce plans"
            emptyDescription="Create a plan to track headcount targets."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setPlanDialog(true)}>New plan</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-workforce-plans"
          />
        </WorkspacePanel>
      </AccessGuard>
      <SkillDialog open={skillDialog} onOpenChange={setSkillDialog} />
      <PlanDialog open={planDialog} onOpenChange={setPlanDialog} />
    </WorkspacePage>
  )
}
