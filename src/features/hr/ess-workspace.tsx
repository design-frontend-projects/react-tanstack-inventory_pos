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
  useAnnouncements,
  useEmployeeRequests,
  useEssMutations,
} from '#/features/hr/use-ess'
import { employeeRequestSchema } from '#/features/hr/ess-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const ACCESS = ['hr.employee_view']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type RequestRow = NonNullable<
  ReturnType<typeof useEmployeeRequests>['data']
>[number]
type AnnouncementRow = NonNullable<
  ReturnType<typeof useAnnouncements>['data']
>[number]

const REQUEST_STATUS_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info'
> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
  rejected: 'danger',
}

const PRIORITY_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info'
> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
}

function RequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [requestType, setRequestType] = React.useState('letter')
  const [subject, setSubject] = React.useState('')
  const [details, setDetails] = React.useState('')
  const [priority, setPriority] = React.useState('normal')
  const [error, setError] = React.useState<string | null>(null)

  const employeesQuery = useEmployees()
  const { submitRequest } = useEssMutations()

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setRequestType('letter')
      setSubject('')
      setDetails('')
      setPriority('normal')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = employeeRequestSchema.safeParse({
      employeeId,
      requestType,
      subject: subject.trim(),
      details: details.trim() || null,
      priority,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await submitRequest.mutateAsync(parsed.data)
      notifySuccess('Request submitted', 'Your request has been logged.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not submit the request')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit a request</DialogTitle>
          <DialogDescription>
            Raise an HR request such as a letter, document, or data change. HR
            will pick it up and update its status.
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
            <Field label="Type">
              <select
                className={selectClassName}
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
              >
                <option value="letter">Letter</option>
                <option value="document">Document</option>
                <option value="data_change">Data change</option>
                <option value="complaint">Complaint</option>
                <option value="inquiry">Inquiry</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Priority">
              <select
                className={selectClassName}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <Field label="Subject">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field label="Details">
            <Input
              value={details}
              onChange={(e) => setDetails(e.target.value)}
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
            <Button type="submit" disabled={submitRequest.isPending}>
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EssWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canAccess = can(ACCESS)
  const [dialog, setDialog] = React.useState(false)

  const requestsQuery = useEmployeeRequests()
  const announcementsQuery = useAnnouncements()
  const employeesQuery = useEmployees()
  const { setRequestStatus } = useEssMutations()

  const requests = requestsQuery.data ?? []
  const announcements = announcementsQuery.data ?? []

  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  async function resolve(id: string) {
    try {
      await setRequestStatus.mutateAsync({ id, statusCode: 'resolved' })
      notifySuccess('Request resolved', '')
    } catch (e: unknown) {
      notifyError(e, 'Could not update the request')
    }
  }

  const requestColumns: DataTableColumn<RequestRow>[] = [
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
      cell: (r) => r.requestType,
      sortValue: (r) => r.requestType,
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (r) => r.subject,
      sortValue: (r) => r.subject,
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (r) => (
        <StatusChip tone={PRIORITY_TONES[r.priority] ?? 'neutral'}>
          {r.priority}
        </StatusChip>
      ),
      sortValue: (r) => r.priority,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={REQUEST_STATUS_TONES[r.statusCode] ?? 'neutral'}>
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
        canAccess && ['open', 'in_progress'].includes(r.statusCode) ? (
          <div className="flex justify-end">
            <Button size="xs" variant="outline" onClick={() => resolve(r.id)}>
              Resolve
            </Button>
          </div>
        ) : null,
    },
  ]

  const openCount = requests.filter((r) =>
    ['open', 'in_progress'].includes(r.statusCode),
  ).length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Self-service"
      title="Raise requests and stay informed."
      description="Submit HR requests and track them to resolution. Company announcements keep everyone up to date."
      actions={
        canAccess ? (
          <Button onClick={() => setDialog(true)}>Submit request</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Open requests',
          value: requestsQuery.isLoading ? '—' : String(openCount),
          hint: 'Awaiting HR',
          tone: 'red',
        },
        {
          label: 'My requests',
          value: requestsQuery.isLoading ? '—' : String(requests.length),
          hint: 'This list',
          tone: 'accent',
        },
        {
          label: 'Announcements',
          value: announcementsQuery.isLoading
            ? '—'
            : String(announcements.length),
          hint: 'Published & draft',
          tone: 'neutral',
        },
      ]}
    >
      <AccessGuard
        permissions={ACCESS}
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
          eyebrow="Requests"
          title="My requests"
          description="Requests you have raised and their current status."
        >
          <DataTable
            columns={requestColumns}
            rows={requests}
            rowKey={(r) => r.id}
            isLoading={requestsQuery.isLoading}
            isError={requestsQuery.isError}
            emptyTitle="No requests yet"
            emptyDescription="Submit a request to get started."
            emptyChildren={
              canAccess ? (
                <Button onClick={() => setDialog(true)}>Submit request</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-ess-requests"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="News"
          title="Announcements"
          description="Company-wide and department announcements."
        >
          {announcementsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading announcements…
            </p>
          ) : announcements.length === 0 ? (
            <WorkspaceEmptyState
              title="No announcements"
              description="Nothing has been posted yet."
            />
          ) : (
            <ul className="space-y-3">
              {announcements.map((a: AnnouncementRow) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {a.isPinned ? (
                        <StatusChip tone="primary">Pinned</StatusChip>
                      ) : null}
                      <span className="text-sm font-semibold text-foreground">
                        {a.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip tone="info">{a.category}</StatusChip>
                      <StatusChip
                        tone={
                          a.statusCode === 'published' ? 'success' : 'neutral'
                        }
                      >
                        {a.statusCode}
                      </StatusChip>
                    </div>
                  </div>
                  {a.body ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {a.body}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>
      </AccessGuard>
      <RequestDialog open={dialog} onOpenChange={setDialog} />
    </WorkspacePage>
  )
}
