'use client'

import { Link } from '@tanstack/react-router'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'

// Routed placeholder for finance domains whose backend services are scheduled
// for later phases (AR, AP, cash, banking, budgets, fixed assets, etc.). Uses
// the same shell as the live workspaces so the screen already feels native, and
// documents the planned capabilities so the sidebar reads as complete.

export interface FinancePlaceholderContent {
  eyebrow: string
  title: string
  description: string
  plannedFeatures: Array<string>
}

export function FinancePlaceholder({
  eyebrow,
  title,
  description,
  plannedFeatures,
}: FinancePlaceholderContent) {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow={eyebrow}
      title={title}
      description={description}
      metrics={[
        {
          label: 'Status',
          value: 'Planned',
          hint: 'Scheduled for a later delivery phase',
          tone: 'accent',
        },
        {
          label: 'Ledger',
          value: 'Live',
          hint: 'General ledger foundation is active today',
          tone: 'red',
        },
        {
          label: 'Data model',
          value: 'Ready',
          hint: 'Tables and rules already provisioned',
          tone: 'neutral',
        },
      ]}
      actions={
        <Button asChild variant="outline">
          <Link to="/finance/dashboard">Back to finance overview</Link>
        </Button>
      }
    >
      <WorkspacePanel
        eyebrow="Coming soon"
        title="This workspace is being activated"
        description="The general ledger, chart of accounts, journals, fiscal calendar, and financial settings are live now. This surface unlocks once its posting adapters and services are switched on."
      >
        <WorkspaceEmptyState
          title="Planned capabilities"
          description="When activated, this screen will provide the enterprise-grade tooling below — wired to the same posting engine, approvals, and audit trail as the rest of Financial Management."
        >
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {plannedFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <span
                  aria-hidden
                  className="mt-1 size-1.5 shrink-0 rounded-full bg-primary"
                />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </WorkspaceEmptyState>
      </WorkspacePanel>
    </WorkspacePage>
  )
}

// Central metadata for every placeholder screen, keyed by module-catalog screen
// code. Placeholder route files stay one-liners that render <FinancePlaceholder>
// with the matching entry.
export const FINANCE_PLACEHOLDERS: Record<string, FinancePlaceholderContent> = {
  'finance-posting-queue': {
    eyebrow: 'General Ledger',
    title: 'Posting Queue',
    description:
      'Monitor and resolve automated postings streamed from sales, purchasing, inventory, and restaurant events before they hit the ledger.',
    plannedFeatures: [
      'Live queue of pending, failed, and retried postings',
      'Per-event drill-down with the generated journal preview',
      'Bulk retry, skip, and reprocess actions',
      'Exception routing to the accountant inbox',
    ],
  },
  'finance-recurring': {
    eyebrow: 'General Ledger',
    title: 'Recurring Journals',
    description:
      'Define template journals that generate automatically on a schedule — accruals, prepayments, depreciation, and standing entries.',
    plannedFeatures: [
      'Journal templates with fixed or formula-driven amounts',
      'Monthly, quarterly, and custom recurrence rules',
      'Auto-draft or auto-post generation modes',
      'Next-run calendar and generation history',
    ],
  },
  'finance-ar-customers': {
    eyebrow: 'Accounts Receivable',
    title: 'AR Customers',
    description:
      'The receivables view of every customer — balances, credit limits, aging, and collection status in one place.',
    plannedFeatures: [
      'Outstanding balance and credit exposure per customer',
      'Aging buckets (current, 30, 60, 90+ days)',
      'Credit limit and hold management',
      'Drill-through to invoices, receipts, and statements',
    ],
  },
  'finance-customer-ledger': {
    eyebrow: 'Accounts Receivable',
    title: 'Customer Ledger',
    description:
      'A full transactional ledger per customer with running balances, allocations, and open-item matching.',
    plannedFeatures: [
      'Chronological ledger with running balance',
      'Open vs. settled item matching',
      'Payment and credit-note allocation history',
      'Export and printable customer statement',
    ],
  },
  'finance-customer-payments': {
    eyebrow: 'Accounts Receivable',
    title: 'Customer Payments',
    description:
      'Receive and allocate customer payments across cash, bank, cheque, card, and transfer with partial-payment support.',
    plannedFeatures: [
      'Multi-method receipt capture',
      'Invoice selection grid with partial allocation',
      'Remaining-balance and on-account handling',
      'Receipt preview, print, and email',
    ],
  },
  'finance-credit-notes': {
    eyebrow: 'Accounts Receivable',
    title: 'Credit Notes',
    description:
      'Issue and apply customer credit notes for returns, adjustments, and goodwill, fully posted to the ledger.',
    plannedFeatures: [
      'Credit note creation with reason codes',
      'Application against open invoices',
      'Refund vs. on-account resolution',
      'Approval workflow and audit trail',
    ],
  },
  'finance-customer-statements': {
    eyebrow: 'Accounts Receivable',
    title: 'Customer Statements',
    description:
      'Generate, preview, and dispatch periodic customer statements with aging and open-item detail.',
    plannedFeatures: [
      'Statement run for a date and customer set',
      'Open-item and balance-forward formats',
      'Batch print and email delivery',
      'Dunning reminder scheduling',
    ],
  },
  'finance-vendors': {
    eyebrow: 'Accounts Payable',
    title: 'Vendors',
    description:
      'The payables view of every supplier — balances, terms, aging, and upcoming payment obligations.',
    plannedFeatures: [
      'Outstanding payable balance per vendor',
      'Payment terms and due-date tracking',
      'Aging buckets and cash-requirement forecast',
      'Drill-through to bills, payments, and debit notes',
    ],
  },
  'finance-vendor-ledger': {
    eyebrow: 'Accounts Payable',
    title: 'Vendor Ledger',
    description:
      'A full transactional ledger per vendor with running balances, allocations, and open-item matching.',
    plannedFeatures: [
      'Chronological ledger with running balance',
      'Open vs. settled bill matching',
      'Payment and debit-note allocation history',
      'Export and printable vendor statement',
    ],
  },
  'finance-vendor-payments': {
    eyebrow: 'Accounts Payable',
    title: 'Vendor Payments',
    description:
      'Run vendor payments individually or in batches with allocation, withholding tax, and remittance advice.',
    plannedFeatures: [
      'Single and batch payment runs',
      'Bill selection with partial allocation',
      'Withholding tax and deductions',
      'Remittance advice preview and print',
    ],
  },
  'finance-debit-notes': {
    eyebrow: 'Accounts Payable',
    title: 'Debit Notes',
    description:
      'Raise and apply debit notes against vendors for returns, price disputes, and adjustments.',
    plannedFeatures: [
      'Debit note creation with reason codes',
      'Application against open bills',
      'Approval workflow and audit trail',
      'Posting to the payables control account',
    ],
  },
  'finance-cash-accounts': {
    eyebrow: 'Cash Management',
    title: 'Cash Accounts',
    description:
      'Manage cash boxes and tills across outlets with live balances and ownership.',
    plannedFeatures: [
      'Cashbox register with live balances',
      'Per-outlet and per-user assignment',
      'Denomination and currency configuration',
      'Links to the mapped GL cash accounts',
    ],
  },
  'finance-cash-transactions': {
    eyebrow: 'Cash Management',
    title: 'Cash Transactions',
    description:
      'Record cash receipts, disbursements, and transfers between cash boxes with full posting.',
    plannedFeatures: [
      'Receipt, payment, and transfer capture',
      'Transfer between cash boxes and to bank',
      'Attachment and note support',
      'Automatic GL posting and audit trail',
    ],
  },
  'finance-cash-sessions': {
    eyebrow: 'Cash Management',
    title: 'Cash Sessions',
    description:
      'Open, count, and close cash sessions with opening float, expected balance, and variance tracking.',
    plannedFeatures: [
      'Session open with declared opening float',
      'Blind cash count at close',
      'Expected vs. counted variance analysis',
      'Daily closing and handover report',
    ],
  },
  'finance-petty-cash': {
    eyebrow: 'Cash Management',
    title: 'Petty Cash',
    description:
      'Operate petty cash floats with imprest replenishment and expense categorisation.',
    plannedFeatures: [
      'Imprest float setup and top-up',
      'Categorised petty expense capture',
      'Replenishment request and posting',
      'Balance and spend reporting',
    ],
  },
  'finance-bank-accounts': {
    eyebrow: 'Banking',
    title: 'Bank Accounts',
    description:
      'Maintain bank accounts with balances, currencies, and links to the mapped GL accounts.',
    plannedFeatures: [
      'Bank account register with live balances',
      'Multi-currency and IBAN details',
      'Opening balance and reconciliation status',
      'Links to the mapped GL bank accounts',
    ],
  },
  'finance-bank-transactions': {
    eyebrow: 'Banking',
    title: 'Bank Transactions',
    description:
      'Capture deposits, withdrawals, and transfers, and import bank statements for matching.',
    plannedFeatures: [
      'Deposit, withdrawal, and transfer capture',
      'Statement import (CSV / camt / OFX)',
      'Attachment and reference support',
      'Automatic GL posting and audit trail',
    ],
  },
  'finance-bank-reconciliation': {
    eyebrow: 'Banking',
    title: 'Bank Reconciliation',
    description:
      'Reconcile bank statements against the ledger with auto-matching and a difference panel.',
    plannedFeatures: [
      'Statement import and auto-matching rules',
      'Matched vs. unmatched transaction panels',
      'Running difference and adjustment entries',
      'Reconciliation sign-off and history',
    ],
  },
  'finance-cheques': {
    eyebrow: 'Banking',
    title: 'Cheques',
    description:
      'Manage the cheque register and post-dated cheques for both receivables and payables.',
    plannedFeatures: [
      'Cheque book and register management',
      'Post-dated cheque (PDC) tracking',
      'Clearing, bounce, and cancellation flows',
      'Maturity calendar and alerts',
    ],
  },
  'finance-cost-centers': {
    eyebrow: 'Cost Accounting',
    title: 'Cost Centers',
    description:
      'Build the cost-center hierarchy and analyse revenue, expense, and profit by center.',
    plannedFeatures: [
      'Hierarchical cost-center tree',
      'Revenue, expense, and profit per center',
      'Journal-line dimension tagging',
      'Allocation rules and usage statistics',
    ],
  },
  'finance-departments': {
    eyebrow: 'Cost Accounting',
    title: 'Departments',
    description:
      'Analyse financial performance by department as an analysis dimension on every posting.',
    plannedFeatures: [
      'Department dimension register',
      'Per-department P&L view',
      'Budget vs. actual by department',
      'Drill-through to source journals',
    ],
  },
  'finance-projects': {
    eyebrow: 'Cost Accounting',
    title: 'Projects',
    description:
      'Track project financials — budget, actuals, revenue, and profitability across their lifecycle.',
    plannedFeatures: [
      'Project register with budget and actuals',
      'Revenue and expense by project',
      'Project P&L and margin analysis',
      'Timeline and linked journal entries',
    ],
  },
  'finance-budget-plans': {
    eyebrow: 'Budgets',
    title: 'Budget Plans',
    description:
      'Create annual and periodic budgets by account, department, and project with a monthly grid.',
    plannedFeatures: [
      'Budget wizard with monthly spread',
      'Department and project budgets',
      'Revisions and transfer approvals',
      'Version comparison and forecasts',
    ],
  },
  'finance-budget-monitoring': {
    eyebrow: 'Budgets',
    title: 'Budget Monitoring',
    description:
      'Track budget consumption with variance dashboards and commitment control.',
    plannedFeatures: [
      'Budget vs. actual variance dashboard',
      'Commitment and availability control',
      'Threshold alerts and overspend warnings',
      'Drill-through to source transactions',
    ],
  },
  'finance-asset-categories': {
    eyebrow: 'Fixed Assets',
    title: 'Asset Categories',
    description:
      'Configure asset categories with default depreciation methods and GL account mappings.',
    plannedFeatures: [
      'Category register with depreciation defaults',
      'Useful-life and salvage conventions',
      'Asset, depreciation, and disposal account mapping',
      'Straight-line and reducing-balance methods',
    ],
  },
  'finance-assets': {
    eyebrow: 'Fixed Assets',
    title: 'Assets',
    description:
      'Maintain the fixed-asset register through acquisition, transfer, revaluation, and disposal.',
    plannedFeatures: [
      'Asset register with book and net values',
      'Acquisition, transfer, and disposal flows',
      'Revaluation and impairment handling',
      'Maintenance log and asset timeline',
    ],
  },
  'finance-depreciation': {
    eyebrow: 'Fixed Assets',
    title: 'Depreciation',
    description:
      'Run periodic depreciation, review schedules, and post depreciation journals automatically.',
    plannedFeatures: [
      'Depreciation run per period',
      'Per-asset depreciation schedule',
      'Automatic journal posting',
      'Catch-up and adjustment handling',
    ],
  },
  'finance-closing': {
    eyebrow: 'Financial Closing',
    title: 'Closing Wizard',
    description:
      'Guide the period and year-end close with a checklist, validations, and progress tracking.',
    plannedFeatures: [
      'Guided period and year-end close checklist',
      'Pre-close validations and warnings',
      'Allocation and opening-balance runs',
      'Progress tracking and sign-off',
    ],
  },
  'finance-tax-settings': {
    eyebrow: 'Settings',
    title: 'Tax Settings',
    description:
      'Configure tax authorities, tax codes, rates, and returns for compliant tax accounting.',
    plannedFeatures: [
      'Tax authorities and tax types',
      'Tax codes with effective-dated rates',
      'Tax code to GL account mapping',
      'VAT/withholding returns and reporting',
    ],
  },
}
