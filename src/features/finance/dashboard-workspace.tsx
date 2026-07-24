'use client'

import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'

import { StatusChip } from '#/components/board/status-chip'
import { SimpleBarChart } from '#/components/charts/simple-bar-chart'
import { documentStatusTone } from '#/components/documents/document-status-flow'
import { KpiGrid, StatCard } from '#/components/data/stat-card'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  formatDate,
  formatJournalStatus,
  formatMoney,
  formatNumber,
  naturalBalance,
  summarizeTrialBalance,
  toNumber,
} from '#/features/finance/finance-format'
import type { JournalEntryRow } from '#/features/finance/use-fin-journals'
import {
  useJournalEntries,
  useTrialBalance,
} from '#/features/finance/use-fin-journals'
import { useFinAccounts } from '#/features/finance/use-fin-accounts'
import { useFiscalYears } from '#/features/finance/use-fin-fiscal'

// CFO overview: headline financial position computed client-side from the
// trial balance joined with the account classification, plus the working queue
// of recent entries and quick paths into the rest of the module.

export function FinanceDashboardWorkspace() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canCreateJournal = can(['finance.journal_create'])

  const yearsQuery = useFiscalYears()
  const accountsQuery = useFinAccounts({})
  const entriesQuery = useJournalEntries({})

  // Balances aggregate across the active fiscal year's periods (≤14 by schema).
  const activeYear = React.useMemo(() => {
    const years = yearsQuery.data ?? []
    return (
      years.find((year) =>
        year.periods.some((period) => period.statusCode === 'open'),
      ) ?? (years.length > 0 ? years[0] : null)
    )
  }, [yearsQuery.data])

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
            typeCode: account.accountType.code,
            controlDomain: account.controlDomain,
          },
        ]),
      ),
    [accountsQuery.data],
  )

  const classifiedRows = React.useMemo(
    () =>
      (trialBalanceQuery.data ?? []).flatMap((row) => {
        const meta = accountMeta.get(row.accountId)
        return meta
          ? [
              {
                ...meta,
                accountCode: row.accountCode,
                accountName: row.accountName,
                debit: row.totalBaseDebit,
                credit: row.totalBaseCredit,
              },
            ]
          : []
      }),
    [trialBalanceQuery.data, accountMeta],
  )

  const summary = React.useMemo(
    () => summarizeTrialBalance(classifiedRows),
    [classifiedRows],
  )

  const topExpenses = React.useMemo(
    () =>
      classifiedRows
        .filter((row) => row.classCode === 'expense')
        .map((row) => ({
          name: `${row.accountCode} ${row.accountName}`,
          amount: naturalBalance(row.classCode, row.debit, row.credit),
        }))
        .filter((row) => row.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
    [classifiedRows],
  )

  const positionData = [
    { section: 'Assets', amount: summary.totalAssets },
    { section: 'Liabilities', amount: summary.totalLiabilities },
    { section: 'Equity', amount: summary.totalEquity },
  ]
  const performanceData = [
    { section: 'Revenue', amount: summary.revenue },
    { section: 'Expenses', amount: summary.expenses },
    { section: 'Net Profit', amount: summary.netProfit },
  ]

  const recentEntries = (entriesQuery.data ?? []).slice(0, 8)
  const draftCount = (entriesQuery.data ?? []).filter(
    (entry) => entry.statusCode === 'draft',
  ).length

  const isLoadingNumbers =
    yearsQuery.isLoading ||
    accountsQuery.isLoading ||
    trialBalanceQuery.isLoading

  const hasLedgerData = classifiedRows.length > 0

  const entryColumns: Array<DataTableColumn<JournalEntryRow>> = [
    {
      id: 'entryNumber',
      header: 'Entry #',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.entryNumber}
        </span>
      ),
      sortValue: (row) => row.entryNumber,
    },
    {
      id: 'entryDate',
      header: 'Date',
      cell: (row) => formatDate(row.entryDate),
      sortValue: (row) => new Date(row.entryDate).getTime(),
    },
    {
      id: 'memo',
      header: 'Description',
      cell: (row) => (
        <span className="line-clamp-1 max-w-72 text-muted-foreground">
          {row.memo ?? row.journalType.name}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      cell: (row) => formatNumber(row.totalBaseDebit),
      sortValue: (row) => toNumber(row.totalBaseDebit),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={documentStatusTone(row.statusCode)} dot>
          {formatJournalStatus(row.statusCode)}
        </StatusChip>
      ),
    },
  ]

  const baseCurrency = 'USD'
  const money = (value: number) => formatMoney(value, baseCurrency)

  return (
    <WorkspacePage
      variant="hero"
      eyebrow="Financial Management"
      title="The financial position, live from the general ledger."
      description={
        activeYear
          ? `Figures aggregate the posted ledger for fiscal year ${activeYear.code} in base currency.`
          : 'Initialize finance to open the first fiscal year and start posting.'
      }
      actions={
        <>
          {canCreateJournal ? (
            <Button onClick={() => navigate({ to: '/finance/journals/new' })}>
              New journal entry
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/finance/reports">Open reports</Link>
          </Button>
        </>
      }
      metrics={[
        {
          label: 'Net profit',
          value: isLoadingNumbers ? '—' : money(summary.netProfit),
          hint: 'Revenue minus expenses, year to date',
          tone: 'red',
        },
        {
          label: 'Cash & bank',
          value: isLoadingNumbers ? '—' : money(summary.cash + summary.bank),
          hint: 'Liquid position across cash boxes and banks',
          tone: 'accent',
        },
        {
          label: 'Drafts pending',
          value: entriesQuery.isLoading ? '—' : String(draftCount),
          hint: 'Journal entries awaiting posting',
          tone: 'neutral',
        },
      ]}
    >
      <KpiGrid columns={4}>
        <StatCard
          label="Total assets"
          value={money(summary.totalAssets)}
          isLoading={isLoadingNumbers}
          tone="primary"
        />
        <StatCard
          label="Total liabilities"
          value={money(summary.totalLiabilities)}
          isLoading={isLoadingNumbers}
        />
        <StatCard
          label="Equity"
          value={money(summary.totalEquity)}
          isLoading={isLoadingNumbers}
        />
        <StatCard
          label="Net profit"
          value={money(summary.netProfit)}
          isLoading={isLoadingNumbers}
          tone={summary.netProfit >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="Revenue"
          value={money(summary.revenue)}
          isLoading={isLoadingNumbers}
          tone="success"
        />
        <StatCard
          label="Expenses"
          value={money(summary.expenses)}
          isLoading={isLoadingNumbers}
          tone="warning"
        />
        <StatCard
          label="Accounts receivable"
          value={money(summary.accountsReceivable)}
          isLoading={isLoadingNumbers}
          hint="Owed by customers"
        />
        <StatCard
          label="Accounts payable"
          value={money(summary.accountsPayable)}
          isLoading={isLoadingNumbers}
          hint="Owed to vendors"
        />
      </KpiGrid>

      {!isLoadingNumbers && !hasLedgerData ? (
        <WorkspaceEmptyState
          title="No posted balances yet"
          description="KPIs light up as soon as the first journal entries post. Initialize finance from Financial Settings, then create and post an opening entry."
        >
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/finance/settings">Financial settings</Link>
            </Button>
            {canCreateJournal ? (
              <Button onClick={() => navigate({ to: '/finance/journals/new' })}>
                First journal entry
              </Button>
            ) : null}
          </div>
        </WorkspaceEmptyState>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel
          eyebrow="Position"
          title="Balance sheet composition"
          description="Assets against liabilities and equity, base currency."
        >
          <SimpleBarChart
            data={positionData}
            xKey="section"
            series={[{ key: 'amount', label: 'Balance' }]}
            height={240}
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Performance"
          title="Income statement summary"
          description="Year-to-date revenue, expenses, and the resulting profit."
        >
          <SimpleBarChart
            data={performanceData}
            xKey="section"
            series={[{ key: 'amount', label: 'Amount' }]}
            height={240}
          />
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel
          eyebrow="Spend"
          title="Top expense accounts"
          description="Where the money goes, ranked by year-to-date spend."
        >
          {topExpenses.length > 0 ? (
            <SimpleBarChart
              data={topExpenses}
              xKey="name"
              series={[{ key: 'amount', label: 'Spend' }]}
              height={280}
              horizontal
            />
          ) : (
            <WorkspaceEmptyState
              title="No expense postings yet"
              description="Expense accounts appear here once entries post against them."
            />
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Activity"
          title="Recent journal entries"
          description="The latest ledger activity. Click through for the full voucher."
        >
          <DataTable
            columns={entryColumns}
            rows={recentEntries}
            rowKey={(row) => row.id}
            isLoading={entriesQuery.isLoading}
            isError={entriesQuery.isError}
            errorMessage="Could not load recent entries."
            emptyTitle="No journal entries yet"
            emptyDescription="Ledger activity shows up here as soon as entries are created."
            onRowClick={(row) =>
              navigate({
                to: '/finance/journals/$entryId',
                params: { entryId: row.id },
              })
            }
          />
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        eyebrow="Shortcuts"
        title="Quick actions"
        description="Jump straight into the day-to-day finance surfaces."
      >
        <div className="flex flex-wrap gap-2">
          {canCreateJournal ? (
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/finance/journals/new' })}
            >
              New journal
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/finance/accounts">Chart of accounts</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/finance/journals">Journal register</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/finance/fiscal">Fiscal calendar</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/finance/reports">Trial balance</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/finance/banking/reconciliation">Reconcile bank</Link>
          </Button>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
