import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/pos/')({
  component: PosCheckoutPage,
})

function PosCheckoutPage() {
  return (
    <WorkspacePage
      eyebrow="POS checkout"
      title="Checkout stays fast when the screen reads like a control rail, not a cluttered dashboard."
      description="The POS group already has room for checkout, order history, and returns without flattening them into one page."
      metrics={[
        { label: 'Open baskets', value: '14', hint: 'Across current lanes', tone: 'teal' },
        { label: 'Average ticket', value: '$28.40', hint: 'Rolling 2 hour window', tone: 'neutral' },
        { label: 'Void risk', value: '2', hint: 'Transactions require review', tone: 'amber' },
      ]}
      actions={
        <Button asChild size="lg" className="rounded-full px-5">
          <Link to="/pos/orders">Review order queue</Link>
        </Button>
      }
    >
      <WorkspacePanel
        eyebrow="Draft lane"
        title="Reserved for the order-entry surface."
        description="This panel is where the Zustand-backed draft basket, search, modifiers, and totals can land."
      >
        <div className="rounded-[1.3rem] border border-dashed border-border/80 bg-background/55 px-5 py-12 text-center text-sm text-muted-foreground">
          POS draft and line-item interface placeholder.
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
