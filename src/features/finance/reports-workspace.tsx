'use client'

import * as React from 'react'

import { StatusChip } from '#/components/board/status-chip'
import { KpiGrid, StatCard } from '#/components/data/stat-card'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FilterBar, FilterSelect } from '#/components/data/filter-bar'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  formatDate,
  formatNumber,
  naturalBalance,
  summarizeTrialBalance,
  toNumber,
} from '#/features/finance/finance-format'
import { useFinAccounts } from '#/features/finance/use-fin-accounts'
import { useFiscalYears } from '#/features/finance/use-fin-fiscal'
import { useTrialBalance } from '#/features/finance/use-fin-journals'

// Reports hub: the trial balance runs live off the GL balance projection; the
// remaining statements activate with the reporting phase of the finance spec.

const PLANNED_REPORTS = [
  ['Balance Sheet', 'Assets, liabilities, and equity at a point in time.'],
  ['Income Statement', 'Revenue and expenses over a period, with profit.'],
  ['Cash Flow', 'Operating, investing, and financing cash movements.'],
  ['General Ledger', 'Full transaction detail for every account.'],
  ['Account Ledger', 'Single-account statement with running balance.'],
  ['Customer Statement', 'Open items and balance per customer.'],
  ['Vendor Statement', 'Open items and balance per vendor.'],
  ['AR / AP Aging', 'Receivables and payables by age bucket.'],
  ['Budget Report', 'Budget vs. actual with variance analysis.'],
  ['VAT Report', 'Tax collected and paid for the filing period.'],
] as const

interface TrialBalanceLine {
  accountId: string
  accountCode: string
  accountName: string
  classCode: string
  className: string
  debit: string
  credit: string
}

export function FinanceReportsWorkspace() {
  const yearsQuery = useFiscalYears()
  const accountsQuery = useFinAccounts({})

  const years = React.useMemo(() => yearsQuery.data ?? [], [yearsQuery.data])
  const [selectedYearId, setSelectedYearId] = React.useState('')

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

  const periodIds = React.useMemo(
    () => (activeYear?.periods ?? []).map((period) => period.id).slice(0, 14),
    [activeYear],
  )
  const trialBalanceQuery = useTrialBalance(periodIds)

  const accountMeta = React.useMemo(
    () =>
      new Map(
        (accountsQuery.data ?? []).map((account) => [
          account.id,
          {
            classCode: account.accountType.accountClass.code,
            className: account.accountType.accountClass.name,
            typeCode: account.accountType.code,
            controlDomain: account.controlDomain,
          },
        ]),
      ),
    [accountsQuery.data],
  )

  const lines: Array<TrialBalanceLine> = React.useMemo(
    () =>
      (trialBalanceQuery.data ?? []).map((row) => {
        const meta = accountMeta.get(row.accountId)
        return {
          accountId: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          classCode: meta?.classCode ?? 'unknown',
          className: meta?.className ?? 'Unclassified',
          debit: row.totalBaseDebit,
          credit: row.totalBaseCredit,
        }
      }),
    [trialBalanceQuery.data, accountMeta],
  )

  const summary = React.useMemo(
    () =>
      summarizeTrialBalance(
        lines.map((line) => ({
          classCode: line.classCode,
          typeCode: '',
          debit: line.debit,
          credit: line.credit,
        })),
      ),
    [lines],
  )

  const isBalanced = Math.abs(summary.difference) <= 0.005

  const columns: Array<DataTableColumn<TrialBalanceLine>> = [
    {
      id: 'code',
      header: 'Code',
      alwaysVisible: true,
      cell: (row) => (
        <span className="font-mono text-xs">{row.accountCode}</span>
      ),
      sortValue: (row) => row.accountCode,
    },
    {
      id: 'account',
      header: 'Account',
      alwaysVisible: true,
      cell: (row) => <span className="font-medium">{row.accountName}</span>,
      sortValue: (row) => row.accountName,
    },
    {
      id: 'class',
      header: 'Class',
      cell: (row) => row.className,
      sortValue: (row) => row.className,
    },
    {
      id: 'debit',
      header: 'Debit',
      align: 'end',
      cell: (row) => formatNumber(row.debit),
      sortValue: (row) => toNumber(row.debit),
      exportValue: (row) => row.debit,
    },
    {
      id: 'credit',
      header: 'Credit',
      align: 'end',
      cell: (row) => formatNumber(row.credit),
      sortValue: (row) => toNumber(row.credit),
      exportValue: (row) => row.credit,
    },
    {
      id: 'net',
      header: 'Net (natural)',
      align: 'end',
      cell: (row) =>
        formatNumber(naturalBalance(row.classCode, row.debit, row.credit)),
      sortValue: (row) => naturalBalance(row.classCode, row.debit, row.credit),
      exportValue: (row) =>
        naturalBalance(row.classCode, row.debit, row.credit),
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Reports"
      title="Financial reports, straight from the posted ledger."
      description="The trial balance reads the maintained GL balance projection live. Statements, agings, and tax reports switch on with the reporting phase."
      metrics={[
        {
          label: 'Total debits',
          value: trialBalanceQuery.isLoading
            ? '—'
            : formatNumber(summary.totalDebit),
          hint: activeYear
            ? `Fiscal year ${activeYear.code}`
            : 'No fiscal year',
          tone: 'red',
        },
        {
          label: 'Total credits',
          value: trialBalanceQuery.isLoading
            ? '—'
            : formatNumber(summary.totalCredit),
          hint: 'Must equal total debits',
          tone: 'accent',
        },
        {
          label: 'Ledger integrity',
          value: trialBalanceQuery.isLoading
            ? '—'
            : isBalanced
              ? 'Balanced'
              : 'Out of balance',
          hint: isBalanced
            ? 'Debits equal credits'
            : `Difference ${formatNumber(summary.difference)}`,
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Live report"
        title="Trial balance"
        description="Aggregated per account over the selected fiscal year, in base currency. Export for working papers."
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
          <StatusChip tone={isBalanced ? 'success' : 'danger'} dot>
            {isBalanced ? 'Balanced' : 'Out of balance'}
          </StatusChip>
        </FilterBar>

        <KpiGrid columns={4} className="mb-4">
          <StatCard
            label="Assets"
            value={formatNumber(summary.totalAssets)}
            isLoading={trialBalanceQuery.isLoading}
          />
          <StatCard
            label="Liabilities"
            value={formatNumber(summary.totalLiabilities)}
            isLoading={trialBalanceQuery.isLoading}
          />
          <StatCard
            label="Revenue"
            value={formatNumber(summary.revenue)}
            isLoading={trialBalanceQuery.isLoading}
          />
          <StatCard
            label="Expenses"
            value={formatNumber(summary.expenses)}
            isLoading={trialBalanceQuery.isLoading}
          />
        </KpiGrid>

        <DataTable
          columns={columns}
          rows={lines}
          rowKey={(row) => row.accountId}
          isLoading={trialBalanceQuery.isLoading || accountsQuery.isLoading}
          isError={trialBalanceQuery.isError}
          errorMessage="Could not read the trial balance."
          emptyTitle="No balances to report"
          emptyDescription="Post journal entries in the selected fiscal year to populate the trial balance."
          pageSize={25}
          enableColumnVisibility
          exportFileName={
            activeYear ? `trial-balance-${activeYear.code}` : 'trial-balance'
          }
        />
      </WorkspacePanel>

      <WorkspacePanel
        eyebrow="Catalog"
        title="Statement library"
        description="The full reporting suite planned for Financial Management. Each activates as its data phase lands."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PLANNED_REPORTS.map(([name, description]) => (
            <article
              key={name}
              className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{name}</p>
                <StatusChip tone="neutral">planned</StatusChip>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
              <Button size="sm" variant="outline" disabled className="w-fit">
                Coming soon
              </Button>
            </article>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
