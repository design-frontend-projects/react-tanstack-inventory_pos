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
  useLearningMutations,
  useTrainingCourses,
  useTrainingRecords,
  useTrainingSessions,
} from '#/features/hr/use-learning'
import {
  trainingCourseWriteSchema,
  trainingSessionCreateSchema,
} from '#/features/hr/learning-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const MANAGE = ['hr.training_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type CourseRow = NonNullable<
  ReturnType<typeof useTrainingCourses>['data']
>[number]
type SessionRow = NonNullable<
  ReturnType<typeof useTrainingSessions>['data']
>[number]
type RecordRow = NonNullable<
  ReturnType<typeof useTrainingRecords>['data']
>[number]

const SESSION_TONES: Partial<
  Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'>
> = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'neutral',
}

const RECORD_TONES: Partial<
  Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info'>
> = {
  enrolled: 'info',
  attended: 'warning',
  completed: 'success',
  failed: 'danger',
  no_show: 'neutral',
}

function CourseDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('general')
  const [deliveryMode, setDeliveryMode] = React.useState('classroom')
  const [provider, setProvider] = React.useState('')
  const [durationHours, setDurationHours] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { createCourse } = useLearningMutations()

  React.useEffect(() => {
    if (open) {
      setCode('')
      setName('')
      setCategory('general')
      setDeliveryMode('classroom')
      setProvider('')
      setDurationHours('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = trainingCourseWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      category: category.trim() || 'general',
      deliveryMode,
      provider: provider.trim() || null,
      durationHours: durationHours.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createCourse.mutateAsync(parsed.data)
      notifySuccess('Course created', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the course')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New training course</DialogTitle>
          <DialogDescription>
            Courses are the catalog; schedule sessions to deliver them.
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery mode">
              <select
                className={selectClassName}
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value)}
              >
                <option value="classroom">Classroom</option>
                <option value="online">Online</option>
                <option value="blended">Blended</option>
                <option value="on_the_job">On the job</option>
              </select>
            </Field>
            <Field label="Duration (hours)">
              <Input
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Provider">
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
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
            <Button type="submit" disabled={createCourse.isPending}>
              Create course
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SessionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [courseId, setCourseId] = React.useState('')
  const [code, setCode] = React.useState('')
  const [trainerName, setTrainerName] = React.useState('')
  const [location, setLocation] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [capacity, setCapacity] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const coursesQuery = useTrainingCourses()
  const { createSession } = useLearningMutations()

  React.useEffect(() => {
    if (open) {
      setCourseId('')
      setCode('')
      setTrainerName('')
      setLocation('')
      setStartDate('')
      setEndDate('')
      setCapacity('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = trainingSessionCreateSchema.safeParse({
      courseId,
      code: code.trim(),
      trainerName: trainerName.trim() || null,
      location: location.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      capacity: capacity.trim() ? Number(capacity) : null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createSession.mutateAsync(parsed.data)
      notifySuccess('Session scheduled', code)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not schedule the session')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New training session</DialogTitle>
          <DialogDescription>
            A scheduled delivery of a course that employees enroll into.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Course">
            <select
              className={selectClassName}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select a course…</option>
              {(coursesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Session code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Capacity">
              <Input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trainer">
              <Input
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
              />
            </Field>
            <Field label="Location">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
          </div>
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
            <Button type="submit" disabled={createSession.isPending}>
              Schedule session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LearningWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [courseDialog, setCourseDialog] = React.useState(false)
  const [sessionDialog, setSessionDialog] = React.useState(false)

  const coursesQuery = useTrainingCourses()
  const sessionsQuery = useTrainingSessions()
  const recordsQuery = useTrainingRecords()
  const employeesQuery = useEmployees()

  const courses = coursesQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const records = recordsQuery.data ?? []

  const courseName = (id: string) =>
    courses.find((c) => c.id === id)?.name ?? '—'
  const sessionCode = (id: string) =>
    sessions.find((s) => s.id === id)?.code ?? '—'
  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  const courseColumns: DataTableColumn<CourseRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Course',
      alwaysVisible: true,
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (r) => r.category,
      sortValue: (r) => r.category,
    },
    {
      id: 'mode',
      header: 'Delivery',
      cell: (r) => r.deliveryMode,
      sortValue: (r) => r.deliveryMode,
    },
    {
      id: 'duration',
      header: 'Hours',
      align: 'end',
      cell: (r) => r.durationHours ?? '—',
      sortValue: (r) => Number(r.durationHours ?? 0),
    },
    {
      id: 'provider',
      header: 'Provider',
      cell: (r) => r.provider ?? '—',
      sortValue: (r) => r.provider ?? '',
    },
  ]

  const sessionColumns: DataTableColumn<SessionRow>[] = [
    {
      id: 'code',
      header: 'Session',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'course',
      header: 'Course',
      alwaysVisible: true,
      cell: (r) => courseName(r.courseId),
      sortValue: (r) => courseName(r.courseId),
    },
    {
      id: 'trainer',
      header: 'Trainer',
      cell: (r) => r.trainerName ?? '—',
      sortValue: (r) => r.trainerName ?? '',
    },
    {
      id: 'dates',
      header: 'Dates',
      cell: (r) =>
        r.startDate ? new Date(r.startDate).toLocaleDateString() : '—',
      sortValue: (r) => (r.startDate ? new Date(r.startDate).getTime() : 0),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={SESSION_TONES[r.statusCode] ?? 'neutral'}>
          {r.statusCode}
        </StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
  ]

  const recordColumns: DataTableColumn<RecordRow>[] = [
    {
      id: 'employee',
      header: 'Employee',
      alwaysVisible: true,
      cell: (r) => empName(r.employeeId),
      sortValue: (r) => empName(r.employeeId),
    },
    {
      id: 'session',
      header: 'Session',
      cell: (r) => sessionCode(r.sessionId),
      sortValue: (r) => sessionCode(r.sessionId),
    },
    {
      id: 'attendance',
      header: 'Attendance %',
      align: 'end',
      cell: (r) => r.attendancePct ?? '—',
      sortValue: (r) => Number(r.attendancePct ?? 0),
    },
    {
      id: 'score',
      header: 'Score',
      align: 'end',
      cell: (r) => r.score ?? '—',
      sortValue: (r) => Number(r.score ?? 0),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={RECORD_TONES[r.statusCode] ?? 'neutral'}>
          {r.statusCode}
        </StatusChip>
      ),
      sortValue: (r) => r.statusCode,
    },
  ]

  const completed = records.filter((r) => r.statusCode === 'completed').length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Learning"
      title="Grow skills with a training catalog and delivery plan."
      description="Maintain the course catalog, schedule delivery sessions, and track employee enrollments from enrolled through completion."
      actions={
        canManage ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSessionDialog(true)}>
              New session
            </Button>
            <Button onClick={() => setCourseDialog(true)}>New course</Button>
          </div>
        ) : null
      }
      metrics={[
        {
          label: 'Courses',
          value: coursesQuery.isLoading ? '—' : String(courses.length),
          hint: 'In catalog',
          tone: 'accent',
        },
        {
          label: 'Sessions',
          value: sessionsQuery.isLoading ? '—' : String(sessions.length),
          hint: 'Scheduled',
          tone: 'neutral',
        },
        {
          label: 'Completed',
          value: recordsQuery.isLoading ? '—' : String(completed),
          hint: 'Enrollments',
          tone: 'red',
        },
      ]}
    >
      <AccessGuard
        permissions={MANAGE}
        userRoles={roles}
        userPermissions={permissions}
        fallback={
          <WorkspaceEmptyState
            title="No access"
            description="Ask for the 'Manage Training' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Catalog"
          title="Training courses"
          description="The reusable catalog of courses."
        >
          <DataTable
            columns={courseColumns}
            rows={courses}
            rowKey={(r) => r.id}
            isLoading={coursesQuery.isLoading}
            isError={coursesQuery.isError}
            emptyTitle="No courses"
            emptyDescription="Add a course to start building the catalog."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setCourseDialog(true)}>
                  New course
                </Button>
              ) : null
            }
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-training-courses"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Delivery"
          title="Sessions"
          description="Scheduled deliveries of courses."
        >
          <DataTable
            columns={sessionColumns}
            rows={sessions}
            rowKey={(r) => r.id}
            isLoading={sessionsQuery.isLoading}
            isError={sessionsQuery.isError}
            emptyTitle="No sessions"
            emptyDescription="Schedule a session to deliver a course."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setSessionDialog(true)}>
                  New session
                </Button>
              ) : null
            }
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-training-sessions"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Attendance"
          title="Enrollments"
          description="Employee training records across all sessions."
        >
          <DataTable
            columns={recordColumns}
            rows={records}
            rowKey={(r) => r.id}
            isLoading={recordsQuery.isLoading}
            isError={recordsQuery.isError}
            emptyTitle="No enrollments"
            emptyDescription="Enrollments appear here once employees join sessions."
            pageSize={10}
            enableColumnVisibility
            exportFileName="hr-training-records"
          />
        </WorkspacePanel>
      </AccessGuard>
      <CourseDialog open={courseDialog} onOpenChange={setCourseDialog} />
      <SessionDialog open={sessionDialog} onOpenChange={setSessionDialog} />
    </WorkspacePage>
  )
}
