import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/inventory/stock')({
  component: StockLedgerPage,
})

function StockLedgerPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Stock ledger"
      title="Movement visibility should read like an audit rail, not a noisy report."
      description="This route is reserved for outlet-item movement trails, threshold review, and the reconciliation logic that feeds replenishment and POS sync."
      metrics={[
        {
          label: 'Movement rows today',
          value: '842',
          hint: 'Sales, restocks, and adjustments',
          tone: 'teal',
        },
        {
          label: 'Variance flags',
          value: '7',
          hint: 'Needs manager review',
          tone: 'amber',
        },
        {
          label: 'Auto updates',
          value: '91%',
          hint: 'Driven by transactional flows',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <WorkspacePanel
          eyebrow="Movement rail"
          title="Latest ledger events"
          description="The future stock table can anchor on the left while this tighter event rail keeps exceptions and updates legible."
        >
          <div className="flex flex-col gap-3">
            {[
              ['-12', 'Chicken fillet sale cluster', 'POS sale at Kasr El Nil'],
              ['+24', 'Sparkling water replenishment', 'Restock at Corniche Hot Line'],
              ['-3', 'Packaging correction', 'Manual adjustment pending note'],
              ['+8', 'Sauce batch received', 'Back-of-house intake verified'],
            ].map(([leading, title, description]) => (
              <WorkspaceTimelineItem
                key={`${leading}-${title}`}
                leading={leading}
                title={title}
                description={description}
              />
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Exception review"
          title="Ledger flags worth escalation"
          description="A short exception set keeps attention on movements that can distort inventory posture."
        >
          <div className="grid gap-4">
            {[
              [
                'Unposted transfer',
                'Two outlet transfers are waiting on receiving confirmation before balances settle.',
                'Transfer queue',
              ],
              [
                'Threshold drift',
                'Frozen prep lines crossed their revised buffer window after the noon rush.',
                'Reorder logic',
              ],
              [
                'Manual adjustment',
                'One packaging correction requires note capture and manager sign-off.',
                'Audit note',
              ],
            ].map(([title, description, meta]) => (
              <WorkspaceDetailCard
                key={title}
                title={title}
                description={description}
                meta={meta}
              />
            ))}
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
