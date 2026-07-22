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
import {
  onboardingTaskWriteSchema,
  onboardingTemplateWriteSchema,
} from '#/features/hr/recruitment-validation'
import { useEmployees } from '#/features/hr/use-employees'
import {
  useEmployeeOnboarding,
  useOnboardingMutations,
  useOnboardingTasks,
  useOnboardingTemplates,
} from '#/features/hr/use-recruitment'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.recruitment_view']
const MANAGE = ['hr.recruitment_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type TemplateRow = NonNullable<
  ReturnType<typeof useOnboardingTemplates>['data']
>[number]
type TaskRow = NonNullable<
  ReturnType<typeof useOnboardingTasks>['data']
>[number]
type AssignmentRow = NonNullable<
  ReturnType<typeof useEmployeeOnboarding>['data']
>[number]

const TASK_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info'
> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  skipped: 'neutral',
}

// --- New template dialog ----------------------------------------------------

function TemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { createTemplate } = useOnboardingMutations()

  React.useEffect(() => {
    if (open) {
      setCode('')
      setName('')
      setDescription('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = onboardingTemplateWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createTemplate.mutateAsync(parsed.data)
      notifySuccess('Template created', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the template')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New onboarding template</DialogTitle>
          <DialogDescription>
            A template is a reusable checklist of onboarding tasks.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            <Button type="submit" disabled={createTemplate.isPending}>
              Create template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Add task dialog --------------------------------------------------------

function TaskDialog({
  open,
  onOpenChange,
  templateId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string | null
}) {
  const [title, setTitle] = React.useState('')
  const [category, setCategory] = React.useState('general')
  const [dueOffsetDays, setDueOffsetDays] = React.useState('0')
  const [error, setError] = React.useState<string | null>(null)
  const { addTask } = useOnboardingMutations()

  React.useEffect(() => {
    if (open) {
      setTitle('')
      setCategory('general')
      setDueOffsetDays('0')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!templateId) {
      setError('Select a template first.')
      return
    }
    const parsed = onboardingTaskWriteSchema.safeParse({
      templateId,
      title: title.trim(),
      category,
      dueOffsetDays: Number(dueOffsetDays) || 0,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await addTask.mutateAsync(parsed.data)
      notifySuccess('Task added', title)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not add the task')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add onboarding task</DialogTitle>
          <DialogDescription>
            The due date is calculated as this many days after the start date.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                className={selectClassName}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="general">General</option>
                <option value="it">IT</option>
                <option value="hr">HR</option>
                <option value="facilities">Facilities</option>
                <option value="compliance">Compliance</option>
                <option value="training">Training</option>
              </select>
            </Field>
            <Field label="Due offset (days)">
              <Input
                type="number"
                min={0}
                value={dueOffsetDays}
                onChange={(e) => setDueOffsetDays(e.target.value)}
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
            <Button type="submit" disabled={addTask.isPending}>
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Assign template dialog -------------------------------------------------

function AssignDialog({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: Array<TemplateRow>
}) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [templateId, setTemplateId] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const employeesQuery = useEmployees()
  const { assignTemplate } = useOnboardingMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setTemplateId('')
      setStartDate('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!employeeId || !templateId) {
      setError('Select an employee and a template.')
      return
    }
    try {
      await assignTemplate.mutateAsync({
        employeeId,
        templateId,
        startDate: startDate || null,
      })
      notifySuccess('Template assigned', 'Onboarding tasks were created.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not assign the template')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign onboarding template</DialogTitle>
          <DialogDescription>
            Every task in the template becomes a dated assignment for the
            employee.
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
          <Field label="Template">
            <select
              className={selectClassName}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
            <Button type="submit" disabled={assignTemplate.isPending}>
              Assign template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Workspace --------------------------------------------------------------

export function OnboardingWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [templateDialog, setTemplateDialog] = React.useState(false)
  const [taskDialog, setTaskDialog] = React.useState(false)
  const [assignDialog, setAssignDialog] = React.useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<
    string | null
  >(null)

  const templatesQuery = useOnboardingTemplates()
  const tasksQuery = useOnboardingTasks(selectedTemplateId)
  const assignmentsQuery = useEmployeeOnboarding()
  const employeesQuery = useEmployees()
  const { deleteTemplate, completeTask } = useOnboardingMutations()

  const templates = templatesQuery.data ?? []
  const tasks = tasksQuery.data ?? []
  const assignments = assignmentsQuery.data ?? []

  React.useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, selectedTemplateId])

  const employeeName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      notifySuccess(success, '')
    } catch (e: unknown) {
      notifyError(e, 'Action failed')
    }
  }

  const templateColumns: DataTableColumn<TemplateRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
      sortValue: (r) => r.code,
    },
    {
      id: 'name',
      header: 'Name',
      alwaysVisible: true,
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="xs"
            variant={selectedTemplateId === r.id ? 'default' : 'outline'}
            onClick={() => setSelectedTemplateId(r.id)}
          >
            Tasks
          </Button>
          {canManage ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                run(() => deleteTemplate.mutateAsync(r.id), 'Template deleted')
              }
            >
              Delete
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const taskColumns: DataTableColumn<TaskRow>[] = [
    {
      id: 'seq',
      header: '#',
      align: 'end',
      cell: (r) => r.sequence,
      sortValue: (r) => r.sequence,
    },
    {
      id: 'title',
      header: 'Task',
      alwaysVisible: true,
      cell: (r) => r.title,
      sortValue: (r) => r.title,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (r) => r.category,
      sortValue: (r) => r.category,
    },
    {
      id: 'due',
      header: 'Due offset',
      align: 'end',
      cell: (r) => `${r.dueOffsetDays}d`,
      sortValue: (r) => r.dueOffsetDays,
    },
  ]

  const assignmentColumns: DataTableColumn<AssignmentRow>[] = [
    {
      id: 'emp',
      header: 'Employee',
      alwaysVisible: true,
      cell: (r) => employeeName(r.employeeId),
      sortValue: (r) => employeeName(r.employeeId),
    },
    {
      id: 'title',
      header: 'Task',
      cell: (r) => r.title,
      sortValue: (r) => r.title,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (r) => r.category,
      sortValue: (r) => r.category,
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
        <StatusChip tone={TASK_TONES[r.statusCode] ?? 'neutral'}>
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
        canManage && r.statusCode !== 'completed' ? (
          <div className="flex justify-end">
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                run(() => completeTask.mutateAsync(r.id), 'Task completed')
              }
            >
              Complete
            </Button>
          </div>
        ) : null,
    },
  ]

  const pendingTasks = assignments.filter(
    (a) => a.statusCode !== 'completed' && a.statusCode !== 'skipped',
  ).length
  const completedTasks = assignments.filter(
    (a) => a.statusCode === 'completed',
  ).length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Onboarding"
      title="Give every new hire a consistent first week."
      description="Build reusable onboarding checklists, then assign them to employees to generate dated, trackable tasks."
      actions={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTemplateDialog(true)}>
              New template
            </Button>
            <Button
              variant="outline"
              onClick={() => setTaskDialog(true)}
              disabled={!selectedTemplateId}
            >
              Add task
            </Button>
            <Button onClick={() => setAssignDialog(true)}>
              Assign template
            </Button>
          </div>
        ) : null
      }
      metrics={[
        {
          label: 'Templates',
          value: templatesQuery.isLoading ? '—' : String(templates.length),
          hint: 'Reusable checklists',
          tone: 'neutral',
        },
        {
          label: 'Pending tasks',
          value: assignmentsQuery.isLoading ? '—' : String(pendingTasks),
          hint: 'Across employees',
          tone: 'red',
        },
        {
          label: 'Completed',
          value: assignmentsQuery.isLoading ? '—' : String(completedTasks),
          hint: 'This list',
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
            description="Ask for the 'View Recruitment' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Templates"
          title="Onboarding templates"
          description="Select a template to view and edit its tasks."
        >
          <DataTable
            columns={templateColumns}
            rows={templates}
            rowKey={(r) => r.id}
            isLoading={templatesQuery.isLoading}
            isError={templatesQuery.isError}
            emptyTitle="No templates"
            emptyDescription="Create a template to define an onboarding checklist."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setTemplateDialog(true)}>
                  New template
                </Button>
              ) : null
            }
            pageSize={10}
            exportFileName="hr-onboarding-templates"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Checklist"
          title="Template tasks"
          description="Tasks belong to the selected template."
        >
          <DataTable
            columns={taskColumns}
            rows={tasks}
            rowKey={(r) => r.id}
            isLoading={Boolean(selectedTemplateId) && tasksQuery.isLoading}
            isError={tasksQuery.isError}
            emptyTitle="No tasks"
            emptyDescription={
              selectedTemplateId
                ? 'Add tasks to this template.'
                : 'Select a template to view its tasks.'
            }
            emptyChildren={
              canManage && selectedTemplateId ? (
                <Button onClick={() => setTaskDialog(true)}>Add task</Button>
              ) : null
            }
            pageSize={10}
            exportFileName="hr-onboarding-tasks"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Assignments"
          title="Employee onboarding"
          description="Tasks generated for employees from assigned templates."
        >
          <DataTable
            columns={assignmentColumns}
            rows={assignments}
            rowKey={(r) => r.id}
            isLoading={assignmentsQuery.isLoading}
            isError={assignmentsQuery.isError}
            emptyTitle="No assignments"
            emptyDescription="Assign a template to an employee to generate tasks."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setAssignDialog(true)}>
                  Assign template
                </Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-employee-onboarding"
          />
        </WorkspacePanel>
      </AccessGuard>

      <TemplateDialog open={templateDialog} onOpenChange={setTemplateDialog} />
      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        templateId={selectedTemplateId}
      />
      <AssignDialog
        open={assignDialog}
        onOpenChange={setAssignDialog}
        templates={templates}
      />
    </WorkspacePage>
  )
}
