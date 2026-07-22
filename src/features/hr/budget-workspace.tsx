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
  useBudgetDepartments,
  useBudgetMutations,
  useBudgetVariance,
  useBudgetYears,
} from '#/features/hr/use-budget'
import { budgetYearWriteSchema } from '#/features/hr/budget-validation'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['hr.analytics_view']
const MANAGE = ['hr.settings_manage']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

type YearRow = NonNullable<ReturnType<typeof useBudgetYears>['data']>[number]
type DeptRow = NonNullable<
  ReturnType<typeof useBudgetDepartments>['data']
>[number]
type VarianceRow = NonNullable<
  ReturnType<typeof useBudgetVariance>['data']
>[number]

const YEAR_STATUS_TONES: Record<
  string,
  'success' | 'warning' | 'neutral' | 'danger' | 'info'
> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  active: 'success',
  closed: 'neutral',
}

function formatMoney(value: string | number): string {
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
}

function BudgetYearDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [fiscalYear, setFiscalYear] = React.useState(
    String(new Date().getUTCFullYear()),
  )
  const [name, setName] = React.useState('')
  const [currencyCode, setCurrencyCode] = React.useState('USD')
  const [totalBudget, setTotalBudget] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const { createYear } = useBudgetMutations()

  React.useEffect(() => {
    if (open) {
      setFiscalYear(String(new Date().getUTCFullYear()))
      setName('')
      setCurrencyCode('USD')
      setTotalBudget('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = budgetYearWriteSchema.safeParse({
      fiscalYear: Number(fiscalYear) || new Date().getUTCFullYear(),
      name: name.trim(),
      currencyCode: currencyCode.trim().toUpperCase() || 'USD',
      totalBudget: totalBudget.trim() || 0,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }
    try {
      await createYear.mutateAsync(parsed.data)
      notifySuccess('Budget year created', name)
      onOpenChange(false)
    } catch (err: unknown) {
      notifyError(err, 'Could not create the budget year')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New budget year</DialogTitle>
          <DialogDescription>
            A budget year is the container for department and position
            allocations and the monthly budget-vs-actual ledger.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fiscal year">
              <Input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={currencyCode}
                maxLength={3}
                onChange={(e) => setCurrencyCode(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Total budget">
            <Input
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
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
            <Button type="submit" disabled={createYear.isPending}>
              Create budget year
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BudgetWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)
  const [dialog, setDialog] = React.useState(false)
  const [selectedYearId, setSelectedYearId] = React.useState<string | null>(
    null,
  )

  const yearsQuery = useBudgetYears()
  const departmentsQuery = useDepartments()

  const years = yearsQuery.data ?? []
  const activeYearId = selectedYearId ?? (years.length > 0 ? years[0].id : null)

  const deptQuery = useBudgetDepartments(activeYearId)
  const varianceQuery = useBudgetVariance(activeYearId)

  const deptName = (id: string) =>
    (departmentsQuery.data ?? []).find((d) => d.id === id)?.name ?? '—'

  const yearColumns: DataTableColumn<YearRow>[] = [
    {
      id: 'year',
      header: 'Year',
      alwaysVisible: true,
      cell: (r) => r.fiscalYear,
      sortValue: (r) => r.fiscalYear,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (r) => r.name,
      sortValue: (r) => r.name,
    },
    {
      id: 'currency',
      header: 'Currency',
      cell: (r) => r.currencyCode,
      sortValue: (r) => r.currencyCode,
    },
    {
      id: 'total',
      header: 'Total budget',
      align: 'end',
      cell: (r) => formatMoney(r.totalBudget),
      sortValue: (r) => Number(r.totalBudget),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusChip tone={YEAR_STATUS_TONES[r.statusCode] ?? 'neutral'}>
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
        <Button
          size="xs"
          variant={r.id === activeYearId ? 'default' : 'outline'}
          onClick={() => setSelectedYearId(r.id)}
        >
          {r.id === activeYearId ? 'Selected' : 'View'}
        </Button>
      ),
    },
  ]

  const deptColumns: DataTableColumn<DeptRow>[] = [
    {
      id: 'department',
      header: 'Department',
      alwaysVisible: true,
      cell: (r) => deptName(r.departmentId),
      sortValue: (r) => deptName(r.departmentId),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (r) => <StatusChip tone="info">{r.budgetType}</StatusChip>,
      sortValue: (r) => r.budgetType,
    },
    {
      id: 'amount',
      header: 'Budget amount',
      align: 'end',
      cell: (r) => formatMoney(r.budgetAmount),
      sortValue: (r) => Number(r.budgetAmount),
    },
    {
      id: 'currency',
      header: 'Currency',
      align: 'end',
      cell: (r) => r.currencyCode,
      sortValue: (r) => r.currencyCode,
    },
  ]

  const varianceColumns: DataTableColumn<VarianceRow>[] = [
    {
      id: 'type',
      header: 'Budget type',
      alwaysVisible: true,
      cell: (r) => r.budgetType,
      sortValue: (r) => r.budgetType,
    },
    {
      id: 'budget',
      header: 'Budget',
      align: 'end',
      cell: (r) => formatMoney(r.budgetAmount),
      sortValue: (r) => Number(r.budgetAmount),
    },
    {
      id: 'actual',
      header: 'Actual',
      align: 'end',
      cell: (r) => formatMoney(r.actualAmount),
      sortValue: (r) => Number(r.actualAmount),
    },
    {
      id: 'variance',
      header: 'Variance',
      align: 'end',
      alwaysVisible: true,
      cell: (r) => {
        const v = Number(r.varianceAmount)
        return (
          <StatusChip tone={v < 0 ? 'danger' : 'success'}>
            {formatMoney(r.varianceAmount)}
          </StatusChip>
        )
      },
      sortValue: (r) => Number(r.varianceAmount),
    },
  ]

  const totalBudgeted = years.reduce((sum, r) => sum + Number(r.totalBudget), 0)

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Budgeting"
      title="Plan and track HR spend by year."
      description="Budget years hold department and position allocations and a monthly budget-vs-actual ledger. Select a year to review its allocations and variance."
      actions={
        canManage ? (
          <Button onClick={() => setDialog(true)}>New budget year</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Budget years',
          value: yearsQuery.isLoading ? '—' : String(years.length),
          hint: 'Defined',
          tone: 'accent',
        },
        {
          label: 'Total budgeted',
          value: yearsQuery.isLoading ? '—' : formatMoney(totalBudgeted),
          hint: 'Across years',
          tone: 'neutral',
        },
        {
          label: 'Department lines',
          value: deptQuery.isLoading
            ? '—'
            : String((deptQuery.data ?? []).length),
          hint: 'Selected year',
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
            description="Ask for the 'View HR Analytics' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Years"
          title="Budget years"
          description="Select a year to load its department budgets and variance."
        >
          <DataTable
            columns={yearColumns}
            rows={years}
            rowKey={(r) => r.id}
            isLoading={yearsQuery.isLoading}
            isError={yearsQuery.isError}
            emptyTitle="No budget years"
            emptyDescription="Create a budget year to get started."
            emptyChildren={
              canManage ? (
                <Button onClick={() => setDialog(true)}>New budget year</Button>
              ) : null
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-budget-years"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Allocations"
          title="Department budgets"
          description="Budget allocated per department for the selected year."
        >
          <DataTable
            columns={deptColumns}
            rows={deptQuery.data ?? []}
            rowKey={(r) => r.id}
            isLoading={deptQuery.isLoading}
            isError={deptQuery.isError}
            emptyTitle="No department budgets"
            emptyDescription={
              activeYearId
                ? 'No allocations recorded for this year.'
                : 'Select a budget year above.'
            }
            pageSize={25}
            enableColumnVisibility
            exportFileName="hr-budget-departments"
          />
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Variance"
          title="Budget vs actual"
          description="Aggregated budget, actual, and variance by budget type for the selected year."
        >
          <DataTable
            columns={varianceColumns}
            rows={varianceQuery.data ?? []}
            rowKey={(r) => r.budgetType}
            isLoading={varianceQuery.isLoading}
            isError={varianceQuery.isError}
            emptyTitle="No actuals yet"
            emptyDescription={
              activeYearId
                ? 'No budget-vs-actual entries for this year.'
                : 'Select a budget year above.'
            }
            pageSize={25}
            exportFileName="hr-budget-variance"
          />
        </WorkspacePanel>
      </AccessGuard>
      <BudgetYearDialog open={dialog} onOpenChange={setDialog} />
    </WorkspacePage>
  )
}
