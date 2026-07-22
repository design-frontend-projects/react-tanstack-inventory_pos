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
  useGoals,
  useKpis,
  usePerformanceMutations,
  useReviews,
} from '#/features/hr/use-performance'
import {
  goalWriteSchema,
  kpiWriteSchema,
  reviewWriteSchema,
} from '#/features/hr/performance-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.performance_view']
const MANAGE = ['hr.performance_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type GoalRow = NonNullable<ReturnType<typeof useGoals>['data']>[number]
type KpiRow = NonNullable<ReturnType<typeof useKpis>['data']>[number]
type ReviewRow = NonNullable<ReturnType<typeof useReviews>['data']>[number]

type StatusTone = 'success' | 'warning' | 'neutral' | 'danger' | 'info'

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'in_progress':
      return 'info'
    case 'completed':
    case 'finalized':
      return 'success'
    default:
      return 'neutral'
  }
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {error}
    </p>
  )
}

// --- New goal ---------------------------------------------------------------

function GoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [kpiId, setKpiId] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [weight, setWeight] = React.useState('')
  const [targetValue, setTargetValue] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const employeesQuery = useEmployees()
  const kpisQuery = useKpis()
  const { createGoal } = usePerformanceMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setKpiId('')
      setTitle('')
      setDescription('')
      setWeight('')
      setTargetValue('')
      setDueDate('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = goalWriteSchema.safeParse({
      employeeId,
      kpiId: kpiId || null,
      title: title.trim(),
      description: description.trim() || null,
      weight: weight.trim() || null,
      targetValue: targetValue.trim() || null,
      dueDate: dueDate || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createGoal.mutateAsync(parsed.data)
      notifySuccess('Goal created', title)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the goal')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
          <DialogDescription>
            Assign a measurable goal to an employee, optionally linked to a KPI.
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
          <Field label="Linked KPI (optional)">
            <select
              className={selectClassName}
              value={kpiId}
              onChange={(e) => setKpiId(e.target.value)}
            >
              <option value="">—</option>
              {(kpisQuery.data ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Weight %">
              <Input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </Field>
            <Field label="Target">
              <Input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createGoal.isPending}>
              Create goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Record progress --------------------------------------------------------

function ProgressDialog({
  goal,
  onOpenChange,
}: {
  goal: GoalRow | null
  onOpenChange: (open: boolean) => void
}) {
  const [progressPct, setProgressPct] = React.useState('')
  const [actualValue, setActualValue] = React.useState('')
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { recordProgress } = usePerformanceMutations()

  React.useEffect(() => {
    if (goal) {
      setProgressPct(String(goal.progressPct ?? ''))
      setActualValue('')
      setNote('')
      setError(null)
    }
  }, [goal])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!goal) return
    setError(null)
    const pct = Number(progressPct)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError('Progress must be a number between 0 and 100.')
      return
    }
    try {
      await recordProgress.mutateAsync({
        goalId: goal.id,
        progressPct: pct,
        actualValue: actualValue.trim() || null,
        note: note.trim() || null,
      })
      notifySuccess('Progress recorded', `${pct}%`)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not record progress')
    }
  }

  return (
    <Dialog open={goal !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record progress</DialogTitle>
          <DialogDescription>
            {goal ? goal.title : ''} — a goal auto-completes at 100%.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Progress %">
            <Input
              type="number"
              min={0}
              max={100}
              value={progressPct}
              onChange={(e) => setProgressPct(e.target.value)}
            />
          </Field>
          <Field label="Actual value (optional)">
            <Input
              value={actualValue}
              onChange={(e) => setActualValue(e.target.value)}
            />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={recordProgress.isPending}>
              Save progress
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- New KPI ----------------------------------------------------------------

function KpiDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('general')
  const [measureUnit, setMeasureUnit] = React.useState('')
  const [targetValue, setTargetValue] = React.useState('')
  const [weight, setWeight] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { createKpi } = usePerformanceMutations()

  React.useEffect(() => {
    if (open) {
      setCode('')
      setName('')
      setCategory('general')
      setMeasureUnit('')
      setTargetValue('')
      setWeight('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = kpiWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      category: category.trim() || 'general',
      measureUnit: measureUnit.trim() || null,
      targetValue: targetValue.trim() || null,
      weight: weight.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createKpi.mutateAsync(parsed.data)
      notifySuccess('KPI created', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the KPI')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New KPI</DialogTitle>
          <DialogDescription>
            Reusable performance indicators that goals and reviews can
            reference.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Category">
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit">
              <Input
                value={measureUnit}
                onChange={(e) => setMeasureUnit(e.target.value)}
              />
            </Field>
            <Field label="Target">
              <Input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </Field>
            <Field label="Weight %">
              <Input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </Field>
          </div>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createKpi.isPending}>
              Create KPI
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- New review -------------------------------------------------------------

function ReviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [reviewType, setReviewType] = React.useState('annual')
  const [periodStart, setPeriodStart] = React.useState('')
  const [periodEnd, setPeriodEnd] = React.useState('')
  const [comments, setComments] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const employeesQuery = useEmployees()
  const { createReview } = usePerformanceMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setReviewType('annual')
      setPeriodStart('')
      setPeriodEnd('')
      setComments('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = reviewWriteSchema.safeParse({
      employeeId,
      reviewType,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      comments: comments.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createReview.mutateAsync(parsed.data)
      notifySuccess('Review created', 'Draft started.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the review')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New performance review</DialogTitle>
          <DialogDescription>
            Start a draft review for an employee. Finalize it to lock the score.
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
          <Field label="Review type">
            <select
              className={selectClassName}
              value={reviewType}
              onChange={(e) => setReviewType(e.target.value)}
            >
              <option value="annual">Annual</option>
              <option value="probation">Probation</option>
              <option value="quarterly">Quarterly</option>
              <option value="project">Project</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period start">
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </Field>
            <Field label="Period end">
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Comments">
            <Input
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </Field>
          <ErrorNote error={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createReview.isPending}>
              Create review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Workspace --------------------------------------------------------------

export function PerformanceWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)

  const [goalDialog, setGoalDialog] = React.useState(false)
  const [kpiDialog, setKpiDialog] = React.useState(false)
  const [reviewDialog, setReviewDialog] = React.useState(false)
  const [progressGoal, setProgressGoal] = React.useState<GoalRow | null>(null)

  const goalsQuery = useGoals()
  const kpisQuery = useKpis()
  const reviewsQuery = useReviews()
  const employeesQuery = useEmployees()
  const { finalizeReview } = usePerformanceMutations()

  const goals = goalsQuery.data ?? []
  const kpis = kpisQuery.data ?? []
  const reviews = reviewsQuery.data ?? []

  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  async function finalize(id: string) {
    try {
      await finalizeReview.mutateAsync({ id })
      notifySuccess('Review finalized', '')
    } catch (e: unknown) {
      notifyError(e, 'Could not finalize the review')
    }
  }

  const goalColumns: DataTableColumn<GoalRow>[] = [
    {
      id: 'title',
      header: 'Goal',
      alwaysVisible: true,
      cell: (r) => r.title,
      sortValue: (r) => r.title,
    },
    {
      id: 'employee',
      header: 'Employee',
      cell: (r) => empName(r.employeeId),
      sortValue: (r) => empName(r.employeeId),
    },
    {
      id: 'progress',
      header: 'Progress',
      align: 'end',
      cell: (r) => {
        const pct = Number(r.progressPct)
        return (
          <div className="flex items-center justify-end gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            <span className="w-10 text-right tabular-nums text-xs">{pct}%</span>
          </div>
        )
      },
      sortValue: (r) => Number(r.progressPct),
    },
    {
      id: 'due',
      header: 'Due',
      cell: (r) => (r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'),
      sortValue: (r) => (r.dueDate ? new Date(r.dueDate).getTime() : 0),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={statusTone(r.statusCode)}>{r.statusCode}</StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage ? (
          <Button
            size="xs"
            variant="outline"
            onClick={() => setProgressGoal(r)}
          >
            Record progress
          </Button>
        ) : null,
    },
  ]

  const reviewColumns: DataTableColumn<ReviewRow>[] = [
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
      cell: (r) => r.reviewType,
      sortValue: (r) => r.reviewType,
    },
    {
      id: 'period',
      header: 'Period',
      cell: (r) =>
        r.periodStart
          ? `${new Date(r.periodStart).toLocaleDateString()} → ${r.periodEnd ? new Date(r.periodEnd).toLocaleDateString() : '—'}`
          : '—',
      sortValue: (r) => (r.periodStart ? new Date(r.periodStart).getTime() : 0),
    },
    {
      id: 'score',
      header: 'Score',
      align: 'end',
      cell: (r) => (r.overallScore ? r.overallScore : '—'),
      sortValue: (r) => Number(r.overallScore ?? 0),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={statusTone(r.statusCode)}>{r.statusCode}</StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) =>
        canManage && r.statusCode !== 'finalized' ? (
          <Button size="xs" variant="outline" onClick={() => finalize(r.id)}>
            Finalize
          </Button>
        ) : null,
    },
  ]

  const activeGoals = goals.filter((g) => g.statusCode === 'in_progress').length
  const draftReviews = reviews.filter(
    (r) => r.statusCode !== 'finalized',
  ).length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Performance"
      title="Drive goals, KPIs, and reviews."
      description="Set measurable goals against KPIs, track progress over time, and finalize performance reviews with a rolled-up score."
      actions={
        canManage ? (
          <Button onClick={() => setGoalDialog(true)}>New goal</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Active goals',
          value: goalsQuery.isLoading ? '—' : String(activeGoals),
          hint: 'In progress',
          tone: 'red',
        },
        {
          label: 'KPIs',
          value: kpisQuery.isLoading ? '—' : String(kpis.length),
          hint: 'Defined',
          tone: 'accent',
        },
        {
          label: 'Open reviews',
          value: reviewsQuery.isLoading ? '—' : String(draftReviews),
          hint: 'Not finalized',
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
            description="Ask for the 'View Performance' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Goals"
          title="Employee goals"
          description="Progress rolls up from recorded entries; goals complete at 100%."
        >
          {canManage ? (
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGoalDialog(true)}
              >
                New goal
              </Button>
            </div>
          ) : null}
          <DataTable
            columns={goalColumns}
            rows={goals}
            rowKey={(r) => r.id}
            isLoading={goalsQuery.isLoading}
            isError={goalsQuery.isError}
            emptyTitle="No goals"
            emptyDescription="Create a goal to get started."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setGoalDialog(true)}>New goal</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-goals"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="KPIs"
          title="Key performance indicators"
          description="The KPI library that goals and review scores reference."
        >
          {canManage ? (
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setKpiDialog(true)}
              >
                New KPI
              </Button>
            </div>
          ) : null}
          {kpis.length === 0 ? (
            <WorkspaceEmptyState
              title="No KPIs"
              description="Define reusable indicators to measure performance."
            >
              {canManage ? (
                <Button onClick={() => setKpiDialog(true)}>New KPI</Button>
              ) : null}
            </WorkspaceEmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {kpis.map((kpi: KpiRow) => (
                <li
                  key={kpi.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{kpi.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {kpi.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{kpi.category}</span>
                    {kpi.targetValue ? (
                      <span className="tabular-nums">
                        {kpi.targetValue}
                        {kpi.measureUnit ? ` ${kpi.measureUnit}` : ''}
                      </span>
                    ) : null}
                    {kpi.weight ? (
                      <span className="tabular-nums">{kpi.weight}%</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Reviews"
          title="Performance reviews"
          description="Draft reviews finalize to a locked, weighted overall score."
        >
          {canManage ? (
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewDialog(true)}
              >
                New review
              </Button>
            </div>
          ) : null}
          <DataTable
            columns={reviewColumns}
            rows={reviews}
            rowKey={(r) => r.id}
            isLoading={reviewsQuery.isLoading}
            isError={reviewsQuery.isError}
            emptyTitle="No reviews"
            emptyDescription="Start a draft review for an employee."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setReviewDialog(true)}>
                  New review
                </Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-performance-reviews"
          />
        </WorkspacePanel>
      </AccessGuard>

      <GoalDialog open={goalDialog} onOpenChange={setGoalDialog} />
      <KpiDialog open={kpiDialog} onOpenChange={setKpiDialog} />
      <ReviewDialog open={reviewDialog} onOpenChange={setReviewDialog} />
      <ProgressDialog
        goal={progressGoal}
        onOpenChange={(open) => (open ? null : setProgressGoal(null))}
      />
    </WorkspacePage>
  )
}
