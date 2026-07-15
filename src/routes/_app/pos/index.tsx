import { Link, createFileRoute } from '@tanstack/react-router'
import {
  CreditCard,
  PackageSearch,
  ReceiptText,
  ScanLine,
  SearchIcon,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/pos/')({
  component: PosCheckoutPage,
})

function PosCheckoutPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="POS checkout"
      title="Checkout runs better when draft entry, queue posture, and totals stay in one clear transaction frame."
      description="This shell reserves space for barcode lookup, draft basket editing, and the payment rail without collapsing back into a generic dashboard."
      metrics={[
        {
          label: 'Open baskets',
          value: '14',
          hint: 'Across current lanes',
          tone: 'teal',
        },
        {
          label: 'Average ticket',
          value: '$28.40',
          hint: 'Rolling 2 hour window',
          tone: 'neutral',
        },
        {
          label: 'Void risk',
          value: '2',
          hint: 'Transactions require review',
          tone: 'amber',
        },
      ]}
      actions={
        <Button asChild size="lg" className="rounded-full px-5">
          <Link to="/pos/orders">Review order queue</Link>
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <WorkspacePanel
          eyebrow="Checkout frame"
          title="Draft basket and lookup lane"
          description="A realistic placeholder for product search, scan actions, draft lines, and modifier review."
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-[1.2rem] border border-border/70 bg-background/75 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <SearchIcon className="text-muted-foreground" />
                <span className="truncate text-sm text-muted-foreground">
                  Search products, scan SKU, or resume a saved basket
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-border/70 bg-muted/65 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  F2 Search
                </span>
                <span className="rounded-full border border-border/70 bg-muted/65 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  F4 Scan
                </span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <WorkspaceEmptyState
                title="Draft basket lane"
                description="Line items, modifiers, discounts, and quantity edits land here with room for scanning and assisted lookup."
              >
                <div className="grid gap-3">
                  {[
                    {
                      title: 'Search queue',
                      description: 'Quick add draft items',
                      icon: SearchIcon,
                    },
                    {
                      title: 'Barcode scan',
                      description: 'Ready for handheld input',
                      icon: ScanLine,
                    },
                    {
                      title: 'Frequent products',
                      description: 'Pin fast-moving SKUs',
                      icon: PackageSearch,
                    },
                  ].map(({ title, description, icon: Icon }) => (
                    <div
                      key={title}
                      className="flex items-center gap-3 rounded-[1rem] border border-border/65 bg-background/75 px-4 py-3"
                    >
                      <Icon className="text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </WorkspaceEmptyState>

              <WorkspaceEmptyState
                title="Modifier and receipt preview"
                description="Once a line is selected, modifiers, notes, and tax-aware receipt details can occupy this side of the draft lane."
              >
                <div className="grid gap-3">
                  {[
                    {
                      title: 'Modifier stack',
                      description: 'No item selected yet',
                    },
                    {
                      title: 'Kitchen note',
                      description: 'Awaiting line focus',
                    },
                    {
                      title: 'Receipt preview',
                      description: 'Tax and tender summary locked to draft',
                    },
                  ].map(({ title, description }) => (
                    <div
                      key={title}
                      className="rounded-[1rem] border border-border/65 bg-background/75 px-4 py-3"
                    >
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              </WorkspaceEmptyState>
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Receipt rail"
          title="Totals and payment posture"
          description="The payment side stays narrow, persistent, and ready for tender decisions."
        >
          <div className="flex flex-col gap-3">
            {[
              {
                label: 'Subtotal',
                value: '$24.80',
                icon: ReceiptText,
              },
              {
                label: 'Service and tax',
                value: '$3.60',
                icon: ReceiptText,
              },
              {
                label: 'Tender options',
                value: 'Cash, card, split',
                icon: CreditCard,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-[1.1rem] border border-border/65 bg-background/75 px-4 py-3"
              >
                <Icon className="text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeof value === 'string' ? value : ''}
                  </p>
                </div>
                {label !== 'Tender options' ? (
                  <span className="text-sm font-semibold">{value}</span>
                ) : null}
              </div>
            ))}

            <div className="rounded-[1.2rem] border border-primary/25 bg-primary/[0.08] p-4">
              <p className="ops-panel-label">Net due</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <strong className="text-3xl font-semibold tracking-tight">
                  $28.40
                </strong>
                <span className="text-xs text-muted-foreground">
                  Ready for payment
                </span>
              </div>
            </div>

            <WorkspaceTimelineItem
              leading="Queue"
              title="2 tickets need manual review"
              description="Use the orders screen to resolve exceptions"
            />
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
