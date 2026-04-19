import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/pos/orders')({
  component: PosOrdersPage,
})

function PosOrdersPage() {
  return (
    <WorkspacePage
      eyebrow="Order queue"
      title="Track transaction flow without losing the signal."
      description="This route is ready for draft, open, completed, and refunded state filters."
      metrics={[
        { label: 'Completed today', value: '286', hint: 'Across all active lanes', tone: 'teal' },
        { label: 'Pending review', value: '6', hint: 'Discounts or manual overrides', tone: 'amber' },
        { label: 'Refunded', value: '3', hint: 'Below weekly average', tone: 'neutral' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Queue posture"
        title="A focused order stream beats a giant generic data grid."
        description="Use this frame for the first transaction queue and completion workflow."
      >
        <div className="flex flex-col gap-3">
          {[
            ['POS-24031', 'Completed', 'Kasr El Nil'],
            ['POS-24032', 'Open', 'Corniche Hot Line'],
            ['POS-24033', 'Refunded', 'Remote Test Counter'],
          ].map(([order, status, outlet]) => (
            <div key={order} className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-border/60 bg-background/55 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{order}</p>
                <p className="text-xs text-muted-foreground">{outlet}</p>
              </div>
              <span className="text-sm text-muted-foreground">{status}</span>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
