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

// Only Suppliers is wired to a route in this phase; the rest are upcoming lanes.
const AVAILABLE_LANE: PurchaseLane & { to: '/purchase/suppliers' } = {
  to: '/purchase/suppliers',
  title: 'Suppliers',
  description:
    'Vendor master with contacts, addresses, bank accounts, categories, rating, and running balance.',
  meta: 'Master data',
}

const UPCOMING_LANES: Array<PurchaseLane> = [
  {
    title: 'Requisitions',
    description:
      'Internal purchase requests with priority, department, and approval routing before they become orders.',
    meta: 'Demand intake',
  },
  {
    title: 'RFQs & Quotations',
    description:
      'Invite suppliers, collect quotations, compare on a single matrix, and award the winner.',
    meta: 'Sourcing',
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
          <Link to={AVAILABLE_LANE.to} className="block">
            <WorkspaceDetailCard
              title={AVAILABLE_LANE.title}
              description={AVAILABLE_LANE.description}
              meta={AVAILABLE_LANE.meta}
            />
          </Link>
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
