import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/inventory/stock')({
  component: StockLedgerPage,
})

function StockLedgerPage() {
  return (
    <WorkspacePage
      eyebrow="Stock ledger"
      title="Movement visibility should feel surgical, not noisy."
      description="Use this page for the outlet-item view, movement trails, and reorder thresholds that feed the future POS and replenishment flows."
      metrics={[
        { label: 'Movement rows today', value: '842', hint: 'Sales, restocks, and adjustments', tone: 'teal' },
        { label: 'Variance flags', value: '7', hint: 'Needs manager review', tone: 'amber' },
        { label: 'Auto updates', value: '91%', hint: 'Driven by transactional flows', tone: 'neutral' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Ledger posture"
        title="A narrow list keeps the operator focused."
        description="The eventual stock table can drop into this frame with filters on the left and movement detail on the right."
      >
        <div className="flex flex-col gap-3">
          {[
            ['Chicken Fillet', '-12', 'POS sale at Kasr El Nil'],
            ['Sparkling Water', '+24', 'Restock at Corniche Hot Line'],
            ['Packaging Set', '-3', 'Manual adjustment pending note'],
          ].map(([label, delta, note]) => (
            <div key={label} className="flex items-center gap-4 rounded-[1.2rem] border border-border/60 bg-background/55 px-4 py-3">
              <div className="min-w-16 text-sm font-semibold">{delta}</div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
