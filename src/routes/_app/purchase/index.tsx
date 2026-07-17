import { Link, createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/purchase/')({
  component: PurchaseOverviewPage,
})

type PurchaseLane = {
  title: string
  description: string
  meta: string
}

// Lanes with shipped routes; the rest render as upcoming.
const AVAILABLE_LANES: Array<
  PurchaseLane & {
    to: '/purchase/suppliers' | '/purchase/rfqs' | '/purchase/quotations'
  }
> = [
  {
    to: '/purchase/suppliers',
    title: 'Suppliers',
    description:
      'Vendor master with contacts, addresses, bank accounts, categories, rating, and running balance.',
    meta: 'Master data',
  },
  {
    to: '/purchase/rfqs',
    title: 'RFQs',
    description:
      'Invite suppliers, track responses and revisions, and award from the comparison matrix.',
    meta: 'Sourcing',
  },
  {
    to: '/purchase/quotations',
    title: 'Quotations',
    description:
      'Supplier quotations with tax, freight, and insurance — reviewed, approved, and converted to POs.',
    meta: 'Sourcing',
  },
]

const UPCOMING_LANES: Array<PurchaseLane> = [
  {
    title: 'Requisitions',
    description:
      'Internal purchase requests with priority, department, and approval routing before they become orders.',
    meta: 'Demand intake',
  },
  {
    title: 'Purchase Orders',
    description:
      'Approved orders with currency, incoterms, delivery terms, and partial receiving tracked to the line.',
    meta: 'Commitment',
  },
  {
    title: 'Supplier Invoices',
    description:
      'Three-way match against PO and GRN, then post to payables with retention and withholding.',
    meta: 'Payables',
  },
  {
    title: 'Payments',
    description:
      'Settle invoices with allocations and advances; supplier balances and aging update automatically.',
    meta: 'Settlement',
  },
]

function PurchaseOverviewPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Purchasing"
      title="Run procurement end to end: source, order, receive, match, and pay."
      description="The purchasing control room links suppliers, requisitions, RFQs, orders, receipts, invoices, and payments into one auditable, approval-gated flow."
      metrics={[
        {
          label: 'Modules',
          value: '6',
          hint: 'Sourcing to settlement lanes',
          tone: 'red',
        },
        {
          label: 'Approval-gated',
          value: 'PR · PO · INV',
          hint: 'Amount-based workflow routing',
          tone: 'accent',
        },
        {
          label: 'Ledger-linked',
          value: 'GRN → Stock',
          hint: 'Receipts post inventory movements',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Procurement lanes"
        title="Jump into a workflow"
        description="Each lane is permission-gated and shares the supplier, numbering, approval, and audit backbone."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AVAILABLE_LANES.map((lane) => (
            <Link key={lane.to} to={lane.to} className="block">
              <WorkspaceDetailCard
                title={lane.title}
                description={lane.description}
                meta={lane.meta}
              />
            </Link>
          ))}
          {UPCOMING_LANES.map((lane) => (
            <WorkspaceDetailCard
              key={lane.title}
              title={lane.title}
              description={lane.description}
              meta={`${lane.meta} · soon`}
              className="opacity-70"
            />
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
