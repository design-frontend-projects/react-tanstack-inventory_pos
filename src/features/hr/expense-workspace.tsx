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
  useExpenseAccounts,
  useExpenseClaims,
  useExpenseMutations,
} from '#/features/hr/use-assets-expense'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.expense_view']
const MANAGE = ['hr.expense_manage']
const APPROVE = ['hr.expense_approve']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type ClaimRow = NonNullable<ReturnType<typeof useExpenseClaims>['data']>[number]

const STATUS_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info' | 'primary'
> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'info',
  posted: 'primary',
  rejected: 'danger',
}

type LineDraft = { category: string; description: string; amount: string }

function NewClaimDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const employeesQuery = useEmployees()
  const { submitClaim } = useExpenseMutations()
  const [employeeId, setEmployeeId] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [lines, setLines] = React.useState<LineDraft[]>([
    { category: 'general', description: '', amount: '' },
  ])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setEmployeeId('')
      setTitle('')
      setLines([{ category: 'general', description: '', amount: '' }])
      setError(null)
    }
  }, [open])

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsedLines = lines
      .filter((l) => l.amount.trim() !== '')
      .map((l) => ({
        category: l.category,
        description: l.description || null,
        amount: l.amount,
      }))
    if (!employeeId || !title.trim() || parsedLines.length === 0) {
      setError(
        'Employee, title, and at least one line with an amount are required.',
      )
      return
    }
    try {
      await submitClaim.mutateAsync({
        employeeId,
        title: title.trim(),
        lines: parsedLines,
      })
      notifySuccess('Claim submitted', title)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not submit the claim')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New expense claim</DialogTitle>
          <DialogDescription>
            Add expense lines; the total is the sum of amounts plus tax.
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
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_100px] gap-2">
                <Input
                  placeholder="Category"
                  value={line.category}
                  onChange={(e) =>
                    updateLine(index, { category: e.target.value })
                  }
                />
                <Input
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) =>
                    updateLine(index, { description: e.target.value })
                  }
                />
                <Input
                  placeholder="Amount"
                  value={line.amount}
                  onChange={(e) =>
                    updateLine(index, { amount: e.target.value })
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() =>
                setLines((p) => [
                  ...p,
                  { category: 'general', description: '', amount: '' },
                ])
              }
            >
              + Add line
            </Button>
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
            <Button type="submit" disabled={submitClaim.isPending}>
              Submit claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReimburseDialog({
  claim,
  onOpenChange,
}: {
  claim: ClaimRow | null
  onOpenChange: (o: boolean) => void
}) {
  const accountsQuery = useExpenseAccounts(claim !== null)
  const { reimburseClaim } = useExpenseMutations()
  const [expenseAccountId, setExpenseAccountId] = React.useState('')
  const [payableAccountId, setPayableAccountId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (claim) {
      setExpenseAccountId('')
      setPayableAccountId('')
      setError(null)
    }
  }, [claim])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!claim) return
    if (!expenseAccountId || !payableAccountId) {
      setError('Select both accounts.')
      return
    }
    try {
      await reimburseClaim.mutateAsync({
        id: claim.id,
        input: { expenseAccountId, payableAccountId },
      })
      notifySuccess('Reimbursed', `Claim ${claim.claimNumber} posted.`)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not reimburse')
    }
  }

  const accounts = accountsQuery.data ?? []

  return (
    <Dialog open={claim !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reimburse expense claim</DialogTitle>
          <DialogDescription>
            Posts a balanced journal: debit expense, credit cash/payable.
            Requires finance configured.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Expense account (Dr)">
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
          <Field label="Cash / payable account (Cr)">
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
          {!accountsQuery.isLoading && accounts.length === 0 ? (
            <p className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              No postable accounts. Configure finance first.
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
              disabled={reimburseClaim.isPending || accounts.length === 0}
            >
              Reimburse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ExpenseWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const canApprove = can(APPROVE)
  const [dialog, setDialog] = React.useState(false)
  const [reimburse, setReimburse] = React.useState<ClaimRow | null>(null)

  const claimsQuery = useExpenseClaims()
  const employeesQuery = useEmployees()
  const { decideClaim } = useExpenseMutations()
  const rows = claimsQuery.data ?? []
  const empName = (id: string) => {
    const e = (employeesQuery.data?.items ?? []).find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  const columns: DataTableColumn<ClaimRow>[] = [
    {
      id: 'number',
      header: 'Claim',
      cell: (r) => <span className="font-mono text-xs">{r.claimNumber}</span>,
      sortValue: (r) => r.claimNumber,
    },
    {
      id: 'title',
      header: 'Title',
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
      id: 'total',
      header: 'Total',
      align: 'end',
      cell: (r) => `${r.totalAmount} ${r.currencyCode}`,
      sortValue: (r) => Number(r.totalAmount),
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
          {canApprove && r.statusCode === 'submitted' ? (
            <>
              <Button
                size="xs"
                variant="outline"
                onClick={async () => {
                  try {
                    await decideClaim.mutateAsync({
                      id: r.id,
                      decision: 'approved',
                    })
                    notifySuccess('Approved', '')
                  } catch (e: unknown) {
                    notifyError(e, 'Failed')
                  }
                }}
              >
                Approve
              </Button>
              <Button
                size="xs"
                variant="destructive"
                onClick={async () => {
                  try {
                    await decideClaim.mutateAsync({
                      id: r.id,
                      decision: 'rejected',
                    })
                    notifySuccess('Rejected', '')
                  } catch (e: unknown) {
                    notifyError(e, 'Failed')
                  }
                }}
              >
                Reject
              </Button>
            </>
          ) : null}
          {canApprove && r.statusCode === 'approved' ? (
            <Button size="xs" variant="outline" onClick={() => setReimburse(r)}>
              Reimburse
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Travel & Expense"
      title="Claim, approve, and reimburse employee expenses."
      description="Expense claims route to approvers and reimburse through the general ledger. Travel requests capture trips and advances."
      actions={
        canManage ? (
          <Button onClick={() => setDialog(true)}>New claim</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Submitted',
          value: claimsQuery.isLoading
            ? '—'
            : String(rows.filter((r) => r.statusCode === 'submitted').length),
          hint: 'Awaiting approval',
          tone: 'red',
        },
        {
          label: 'Approved',
          value: claimsQuery.isLoading
            ? '—'
            : String(rows.filter((r) => r.statusCode === 'approved').length),
          hint: 'Ready to pay',
          tone: 'accent',
        },
        {
          label: 'Reimbursed',
          value: claimsQuery.isLoading
            ? '—'
            : String(rows.filter((r) => r.statusCode === 'posted').length),
          hint: 'Posted to GL',
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
            description="Ask for the 'View Travel & Expense' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Claims"
          title="Expense claims"
          description="submitted → approved → reimbursed (posted to GL)."
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            isLoading={claimsQuery.isLoading}
            isError={claimsQuery.isError}
            emptyTitle="No expense claims"
            emptyDescription="Submit a claim to get started."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setDialog(true)}>New claim</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-expense-claims"
          />
        </WorkspacePanel>
      </AccessGuard>
      <NewClaimDialog open={dialog} onOpenChange={setDialog} />
      <ReimburseDialog
        claim={reimburse}
        onOpenChange={(o) => {
          if (!o) setReimburse(null)
        }}
      />
    </WorkspacePage>
  )
}
