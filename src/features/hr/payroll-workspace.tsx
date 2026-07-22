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
  usePayrollMutations,
  usePayrollPeriods,
  usePayrollRuns,
  usePostableAccounts,
} from '#/features/hr/use-payroll'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.payroll_view']
const RUN = ['hr.payroll_run']
const POST = ['hr.payroll_post']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type RunRow = NonNullable<ReturnType<typeof usePayrollRuns>['data']>[number]

const STATUS_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info' | 'primary'
> = {
  draft: 'neutral',
  calculated: 'info',
  approved: 'warning',
  posted: 'primary',
  paid: 'success',
}

function CreateRunDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const periodsQuery = usePayrollPeriods()
  const { createRun } = usePayrollMutations()
  const [periodId, setPeriodId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setPeriodId('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!periodId) {
      setError('Select a pay period.')
      return
    }
    try {
      await createRun.mutateAsync({ periodId })
      notifySuccess('Payroll run created', 'Now calculate it.')
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the run')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription>
            A run calculates payslips for every active employee in the period.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Pay period">
            <select
              className={selectClassName}
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              <option value="">Select a period…</option>
              {(periodsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
            <Button type="submit" disabled={createRun.isPending}>
              Create run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreatePeriodDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { createPeriod } = usePayrollMutations()
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [payDate, setPayDate] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setCode('')
      setName('')
      setStartDate('')
      setEndDate('')
      setPayDate('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code || !name || !startDate || !endDate) {
      setError('Code, name, start and end dates are required.')
      return
    }
    try {
      await createPeriod.mutateAsync({
        code,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        payDate: payDate ? new Date(payDate) : null,
      })
      notifySuccess('Period created', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the period')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New pay period</DialogTitle>
          <DialogDescription>
            Define the payroll cycle window and pay date.
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
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="End">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
            <Field label="Pay date">
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
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
            <Button type="submit" disabled={createPeriod.isPending}>
              Create period
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PostDialog({
  run,
  onOpenChange,
}: {
  run: RunRow | null
  onOpenChange: (o: boolean) => void
}) {
  const accountsQuery = usePostableAccounts(run !== null)
  const { postRun } = usePayrollMutations()
  const [expenseAccountId, setExpenseAccountId] = React.useState('')
  const [payableAccountId, setPayableAccountId] = React.useState('')
  const [deductionsAccountId, setDeductionsAccountId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (run) {
      setExpenseAccountId('')
      setPayableAccountId('')
      setDeductionsAccountId('')
      setError(null)
    }
  }, [run])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!run) return
    if (!expenseAccountId || !payableAccountId) {
      setError('Select an expense and a payable account.')
      return
    }
    try {
      await postRun.mutateAsync({
        id: run.id,
        input: {
          expenseAccountId,
          payableAccountId,
          deductionsAccountId: deductionsAccountId || null,
        },
      })
      notifySuccess('Posted to GL', `Run ${run.runNumber} posted.`)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not post to finance')
    }
  }

  const accounts = accountsQuery.data ?? []

  return (
    <Dialog open={run !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post payroll to finance</DialogTitle>
          <DialogDescription>
            Posts a balanced journal: debit salary expense (gross), credit
            net-pay payable and deductions. Requires finance to be configured.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Salary expense account (Dr gross)">
            <select
              className={selectClassName}
              value={expenseAccountId}
              onChange={(e) => setExpenseAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Net-pay payable account (Cr net)">
            <select
              className={selectClassName}
              value={payableAccountId}
              onChange={(e) => setPayableAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deductions payable account (optional)">
            <select
              className={selectClassName}
              value={deductionsAccountId}
              onChange={(e) => setDeductionsAccountId(e.target.value)}
            >
              <option value="">Same as payable</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </Field>
          {accountsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading accounts…</p>
          ) : null}
          {!accountsQuery.isLoading && accounts.length === 0 ? (
            <p className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              No postable accounts found. Bootstrap the finance module and
              create a chart of accounts first.
            </p>
          ) : null}
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
            <Button
              type="submit"
              disabled={postRun.isPending || accounts.length === 0}
            >
              Post to GL
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PayrollWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canRun = can(RUN)
  const canPost = can(POST)
  const [runDialog, setRunDialog] = React.useState(false)
  const [periodDialog, setPeriodDialog] = React.useState(false)
  const [postRun, setPostRun] = React.useState<RunRow | null>(null)

  const runsQuery = usePayrollRuns()
  const periodsQuery = usePayrollPeriods()
  const { calculateRun, approveRun, payRun } = usePayrollMutations()

  const rows = runsQuery.data ?? []
  const periodName = (id: string) =>
    (periodsQuery.data ?? []).find((p) => p.id === id)?.name ?? '—'

  async function act(fn: Promise<unknown>, ok: string) {
    try {
      await fn
      notifySuccess(ok, '')
    } catch (e: unknown) {
      notifyError(e, 'Action failed')
    }
  }

  const columns: DataTableColumn<RunRow>[] = [
    {
      id: 'number',
      header: 'Run',
      cell: (r) => <span className="font-mono text-xs">{r.runNumber}</span>,
      sortValue: (r) => r.runNumber,
    },
    {
      id: 'period',
      header: 'Period',
      alwaysVisible: true,
      cell: (r) => periodName(r.periodId),
      sortValue: (r) => periodName(r.periodId),
    },
    {
      id: 'count',
      header: 'Employees',
      align: 'end',
      cell: (r) => r.employeeCount,
      sortValue: (r) => r.employeeCount,
    },
    {
      id: 'gross',
      header: 'Gross',
      align: 'end',
      cell: (r) => `${r.totalGross} ${r.currencyCode}`,
      sortValue: (r) => Number(r.totalGross),
    },
    {
      id: 'net',
      header: 'Net',
      align: 'end',
      cell: (r) => `${r.totalNet} ${r.currencyCode}`,
      sortValue: (r) => Number(r.totalNet),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={STATUS_TONES[r.statusCode] ?? 'neutral'}>
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
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {canRun && ['draft', 'calculated'].includes(r.statusCode) ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => act(calculateRun.mutateAsync(r.id), 'Calculated')}
            >
              Calculate
            </Button>
          ) : null}
          {canPost && r.statusCode === 'calculated' ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => act(approveRun.mutateAsync(r.id), 'Approved')}
            >
              Approve
            </Button>
          ) : null}
          {canPost && r.statusCode === 'approved' ? (
            <Button size="xs" variant="outline" onClick={() => setPostRun(r)}>
              Post to GL
            </Button>
          ) : null}
          {canPost && r.statusCode === 'posted' ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => act(payRun.mutateAsync(r.id), 'Marked paid')}
            >
              Mark paid
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const totalPayrollNet = rows
    .filter((r) => ['posted', 'paid'].includes(r.statusCode))
    .reduce((s, r) => s + Number(r.totalNet), 0)

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Payroll"
      title="Calculate, approve, and post payroll — end to end."
      description="Runs derive every payslip from contracts, components, benefits, overtime, and loan repayments. Posting writes a balanced journal to the general ledger."
      actions={
        canRun ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPeriodDialog(true)}>
              New period
            </Button>
            <Button onClick={() => setRunDialog(true)}>New run</Button>
          </div>
        ) : null
      }
      metrics={[
        {
          label: 'Runs',
          value: runsQuery.isLoading ? '—' : String(rows.length),
          hint: 'All time',
          tone: 'red',
        },
        {
          label: 'Periods',
          value: periodsQuery.isLoading
            ? '—'
            : String((periodsQuery.data ?? []).length),
          hint: 'Defined',
          tone: 'accent',
        },
        {
          label: 'Posted net',
          value: runsQuery.isLoading ? '—' : totalPayrollNet.toFixed(0),
          hint: 'Posted/paid',
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
            description="Ask for the 'View Payroll' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Runs"
          title="Payroll runs"
          description="draft → calculated → approved → posted → paid."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={runsQuery.isLoading}
            isError={runsQuery.isError}
            emptyTitle="No payroll runs"
            emptyDescription="Create a pay period, then a run."
            emptyChildren={
              canRun ? (
                <Button onClick={() => setPeriodDialog(true)}>
                  New period
                </Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-payroll-runs"
          />
        </WorkspacePanel>
      </AccessGuard>
      <CreateRunDialog open={runDialog} onOpenChange={setRunDialog} />
      <CreatePeriodDialog open={periodDialog} onOpenChange={setPeriodDialog} />
      <PostDialog
        run={postRun}
        onOpenChange={(o) => {
          if (!o) setPostRun(null)
        }}
      />
    </WorkspacePage>
  )
}
