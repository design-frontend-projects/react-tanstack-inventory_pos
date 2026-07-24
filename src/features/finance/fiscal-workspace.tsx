'use client'

import * as React from 'react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  FilterBar,
  FilterSelect,
  filterSelectClassName,
} from '#/components/data/filter-bar'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import {
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  formatDate,
  formatPeriodStatus,
} from '#/features/finance/finance-format'
import type { FiscalPeriodRow } from '#/features/finance/use-fin-fiscal'
import {
  useFiscalMutations,
  useFiscalYears,
} from '#/features/finance/use-fin-fiscal'
import {
  getErrorMessage,
  notifyError,
  notifySuccess,
} from '#/lib/toast/toast-store'

const MANAGE_PERMISSIONS = ['finance.fiscal_manage']

// Modules that can be locked per period independently of the period status.
const LOCKABLE_MODULES = [
  { value: 'gl', label: 'General Ledger' },
  { value: 'ar', label: 'Receivables' },
  { value: 'ap', label: 'Payables' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Banking' },
]

function periodTone(
  status: string,
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'open':
      return 'success'
    case 'closed':
      return 'warning'
    case 'locked':
      return 'danger'
    default:
      return 'neutral'
  }
}

interface PendingTransition {
  period: FiscalPeriodRow
  toStatus: 'open' | 'closed' | 'locked'
  title: string
  description: string
  tone: 'default' | 'destructive'
}

export function FinanceFiscalWorkspace() {
  const { can } = usePermissions()
  const canManage = can(MANAGE_PERMISSIONS)

  const yearsQuery = useFiscalYears()
  const { createFiscalYear, transitionPeriod, setModuleLock } =
    useFiscalMutations()

  const years = React.useMemo(() => yearsQuery.data ?? [], [yearsQuery.data])
  const [selectedYearId, setSelectedYearId] = React.useState('')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [pendingTransition, setPendingTransition] =
    React.useState<PendingTransition | null>(null)
  const [lockTarget, setLockTarget] = React.useState<FiscalPeriodRow | null>(
    null,
  )
  const [lockModule, setLockModule] = React.useState('gl')

  // Newest year with an open period wins as the default selection.
  const activeYear = React.useMemo(() => {
    if (selectedYearId) {
      return years.find((year) => year.id === selectedYearId) ?? null
    }
    return (
      years.find((year) =>
        year.periods.some((period) => period.statusCode === 'open'),
      ) ?? (years.length > 0 ? years[0] : null)
    )
  }, [years, selectedYearId])

  const openPeriods = years.flatMap((year) =>
    year.periods.filter((period) => period.statusCode === 'open'),
  )

  // --- Create fiscal year form ------------------------------------------------
  const [yearCode, setYearCode] = React.useState('')
  const [yearStart, setYearStart] = React.useState('')
  const [periodCount, setPeriodCount] = React.useState('12')
  const [withAdjustment, setWithAdjustment] = React.useState(true)
  const [openFirst, setOpenFirst] = React.useState(true)
  const [createError, setCreateError] = React.useState<string | null>(null)

  async function handleCreateYear() {
    setCreateError(null)
    try {
      const created = await createFiscalYear.mutateAsync({
        code: yearCode.trim(),
        startDate: new Date(yearStart),
        periodCount: Number(periodCount) || 12,
        includeAdjustmentPeriod: withAdjustment,
        openFirstPeriod: openFirst,
      })
      notifySuccess('Fiscal year created', `${created.code} is ready.`)
      setCreateOpen(false)
      setYearCode('')
      setYearStart('')
    } catch (error: unknown) {
      setCreateError(getErrorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<FiscalPeriodRow>> = [
    {
      id: 'periodNumber',
      header: '#',
      cell: (row) => row.periodNumber,
      sortValue: (row) => row.periodNumber,
    },
    {
      id: 'name',
      header: 'Period',
      alwaysVisible: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-2 font-medium">
          {row.name}
          {row.isAdjustmentPeriod ? (
            <StatusChip tone="info">adjustment</StatusChip>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.periodNumber,
      exportValue: (row) => row.name,
    },
    {
      id: 'startDate',
      header: 'Starts',
      cell: (row) => formatDate(row.startDate),
      sortValue: (row) => new Date(row.startDate).getTime(),
      exportValue: (row) => formatDate(row.startDate),
    },
    {
      id: 'endDate',
      header: 'Ends',
      cell: (row) => formatDate(row.endDate),
      sortValue: (row) => new Date(row.endDate).getTime(),
      exportValue: (row) => formatDate(row.endDate),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={periodTone(row.statusCode)} dot>
          {formatPeriodStatus(row.statusCode)}
        </StatusChip>
      ),
      sortValue: (row) => row.statusCode,
      exportValue: (row) => row.statusCode,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (row) =>
        canManage ? (
          <div className="flex items-center justify-end gap-1.5">
            {row.statusCode === 'future' || row.statusCode === 'closed' ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  setPendingTransition({
                    period: row,
                    toStatus: 'open',
                    title: `${row.statusCode === 'closed' ? 'Reopen' : 'Open'} ${row.name}?`,
                    description:
                      'Open periods accept postings from every finance module unless a module lock says otherwise.',
                    tone: 'default',
                  })
                }
              >
                {row.statusCode === 'closed' ? 'Reopen' : 'Open'}
              </Button>
            ) : null}
            {row.statusCode === 'open' ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  setPendingTransition({
                    period: row,
                    toStatus: 'closed',
                    title: `Close ${row.name}?`,
                    description:
                      'Closed periods reject new postings. You can reopen a closed period until it is locked.',
                    tone: 'default',
                  })
                }
              >
                Close
              </Button>
            ) : null}
            {row.statusCode === 'closed' ? (
              <Button
                size="xs"
                variant="destructive"
                onClick={() =>
                  setPendingTransition({
                    period: row,
                    toStatus: 'locked',
                    title: `Lock ${row.name}?`,
                    description:
                      'Locking is final: the period can never be reopened. Use it once the close is audited.',
                    tone: 'destructive',
                  })
                }
              >
                Lock
              </Button>
            ) : null}
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setLockTarget(row)
                setLockModule('gl')
              }}
            >
              Module locks
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Financial Closing"
      title="Fiscal years and periods, from opening to final lock."
      description="Periods gate every posting: open accepts entries, closed rejects them but can reopen, locked is final. Module locks close a single subledger ahead of the whole period."
      actions={
        canManage ? (
          <Button onClick={() => setCreateOpen(true)}>New fiscal year</Button>
        ) : null
      }
      metrics={[
        {
          label: 'Fiscal years',
          value: yearsQuery.isLoading ? '—' : String(years.length),
          hint: 'Configured calendars',
          tone: 'red',
        },
        {
          label: 'Open periods',
          value: yearsQuery.isLoading ? '—' : String(openPeriods.length),
          hint: 'Currently accepting postings',
          tone: 'accent',
        },
        {
          label: 'Current period',
          value: openPeriods[0]?.name ?? '—',
          hint: 'First open period across years',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Calendar"
        title={
          activeYear ? `Fiscal year ${activeYear.code}` : 'Fiscal calendar'
        }
        description="Pick a fiscal year to review and manage its periods."
      >
        <FilterBar className="mb-4">
          <FilterSelect
            label="Fiscal year"
            value={activeYear?.id ?? ''}
            onChange={setSelectedYearId}
            includeAll={false}
            options={years.map((year) => ({
              value: year.id,
              label: `${year.code} (${formatDate(year.startDate)} → ${formatDate(year.endDate)})`,
            }))}
          />
          {activeYear ? (
            <StatusChip
              tone={activeYear.statusCode === 'open' ? 'success' : 'neutral'}
              dot
            >
              {activeYear.statusCode}
            </StatusChip>
          ) : null}
        </FilterBar>

        <DataTable
          columns={columns}
          rows={activeYear?.periods ?? []}
          rowKey={(row) => row.id}
          isLoading={yearsQuery.isLoading}
          isError={yearsQuery.isError}
          errorMessage="Could not load the fiscal calendar."
          emptyTitle="No fiscal years yet"
          emptyDescription="Create a fiscal year — or run finance initialization from Financial Settings — to start the posting calendar."
          emptyChildren={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                New fiscal year
              </Button>
            ) : undefined
          }
          exportFileName={
            activeYear ? `fiscal-${activeYear.code}` : 'fiscal-periods'
          }
        />
      </WorkspacePanel>

      <DrawerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New fiscal year"
        description="Generates the monthly periods automatically from the start date."
        onSubmit={handleCreateYear}
        submitLabel="Create fiscal year"
        isPending={createFiscalYear.isPending}
        error={createError}
        submitDisabled={yearCode.trim() === '' || yearStart === ''}
      >
        <Field label="Year code" htmlFor="fiscal-year-code" required>
          <input
            id="fiscal-year-code"
            className={fieldInputClassName}
            value={yearCode}
            onChange={(event) => setYearCode(event.target.value)}
            placeholder="e.g. FY2026"
            maxLength={40}
          />
        </Field>
        <Field label="Start date" htmlFor="fiscal-year-start" required>
          <input
            id="fiscal-year-start"
            type="date"
            className={fieldInputClassName}
            value={yearStart}
            onChange={(event) => setYearStart(event.target.value)}
          />
        </Field>
        <Field
          label="Number of periods"
          htmlFor="fiscal-year-periods"
          hint="Usually 12 monthly periods."
        >
          <input
            id="fiscal-year-periods"
            type="number"
            min="1"
            max="12"
            className={fieldInputClassName}
            value={periodCount}
            onChange={(event) => setPeriodCount(event.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withAdjustment}
            onChange={(event) => setWithAdjustment(event.target.checked)}
          />
          <span>
            Include adjustment period
            <span className="block text-xs text-muted-foreground">
              A 13th period reserved for audit and year-end adjustments.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openFirst}
            onChange={(event) => setOpenFirst(event.target.checked)}
          />
          <span>Open the first period immediately</span>
        </label>
      </DrawerForm>

      <ConfirmDialog
        open={pendingTransition !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTransition(null)
          }
        }}
        title={pendingTransition?.title ?? ''}
        description={pendingTransition?.description}
        confirmLabel="Confirm"
        tone={pendingTransition?.tone ?? 'default'}
        isPending={transitionPeriod.isPending}
        onConfirm={async () => {
          if (!pendingTransition) {
            return
          }
          try {
            await transitionPeriod.mutateAsync({
              periodId: pendingTransition.period.id,
              toStatus: pendingTransition.toStatus,
            })
            notifySuccess(
              'Period updated',
              `${pendingTransition.period.name} is now ${pendingTransition.toStatus}.`,
            )
            setPendingTransition(null)
          } catch (error: unknown) {
            notifyError(error, 'Could not update the period')
          }
        }}
      />

      <DrawerForm
        open={lockTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLockTarget(null)
          }
        }}
        title={
          lockTarget ? `Module locks — ${lockTarget.name}` : 'Module locks'
        }
        description="Lock a single module's postings for this period while others stay open. Applying again with unlock removes the lock."
        onSubmit={async () => {
          if (!lockTarget) {
            return
          }
          try {
            await setModuleLock.mutateAsync({
              periodId: lockTarget.id,
              moduleCode: lockModule,
              locked: true,
            })
            notifySuccess(
              'Module locked',
              `${lockModule.toUpperCase()} postings are blocked in ${lockTarget.name}.`,
            )
            setLockTarget(null)
          } catch (error: unknown) {
            notifyError(error, 'Could not apply the module lock')
          }
        }}
        submitLabel="Lock module"
        isPending={setModuleLock.isPending}
      >
        <Field label="Module" htmlFor="fiscal-lock-module">
          <select
            id="fiscal-lock-module"
            className={filterSelectClassName}
            value={lockModule}
            onChange={(event) => setLockModule(event.target.value)}
          >
            {LOCKABLE_MODULES.map((module) => (
              <option key={module.value} value={module.value}>
                {module.label}
              </option>
            ))}
          </select>
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={setModuleLock.isPending || !lockTarget}
          onClick={async () => {
            if (!lockTarget) {
              return
            }
            try {
              await setModuleLock.mutateAsync({
                periodId: lockTarget.id,
                moduleCode: lockModule,
                locked: false,
              })
              notifySuccess(
                'Module unlocked',
                `${lockModule.toUpperCase()} postings are allowed again in ${lockTarget.name}.`,
              )
              setLockTarget(null)
            } catch (error: unknown) {
              notifyError(error, 'Could not remove the module lock')
            }
          }}
        >
          Unlock this module instead
        </Button>
      </DrawerForm>
    </WorkspacePage>
  )
}
