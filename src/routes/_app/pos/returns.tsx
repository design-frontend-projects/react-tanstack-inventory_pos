import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/pos/returns')({
  component: PosReturnsPage,
})

function PosReturnsPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Returns"
      title="Returns stay close to checkout, but the workflow should feel stricter and more traceable."
      description="This route is reserved for reversal reasons, inventory impact, tender checks, and manager approval before a refund is released."
      metrics={[
        {
          label: 'Today',
          value: '3',
          hint: 'Below tolerance band',
          tone: 'neutral',
        },
        {
          label: 'Approval needed',
          value: '1',
          hint: 'High-value basket',
          tone: 'amber',
        },
        {
          label: 'Restocked lines',
          value: '8',
          hint: 'Ready to sync into stock movements',
          tone: 'teal',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <WorkspacePanel
          eyebrow="Return gate"
          title="Reason capture and stock reversal checks"
          description="Keep the approval rail narrow so every return still reads like an audited transaction."
        >
          <div className="grid gap-4">
            {[
              [
                'Reason code capture',
                'Classify damage, wrong item, or manual void before the transaction can move forward.',
                'Mandatory',
              ],
              [
                'Inventory reversal',
                'Mark whether stock returns to saleable, quarantine, or discard inventory.',
                'Stock impact',
              ],
              [
                'Tender confirmation',
                'Ensure the refund path matches the original tender and shift close rules.',
                'Tender check',
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

        <WorkspacePanel
          eyebrow="Approval lane"
          title="Manager sign-off surface"
          description="High-value or policy-breaking returns can settle in a separate approval rail without interrupting checkout."
        >
          <div className="flex flex-col gap-3">
            <WorkspaceEmptyState
              title="Approval workflow placeholder"
              description="Use this well for approval comments, policy exceptions, and a final refund release action."
            />
            <WorkspaceTimelineItem
              leading="1"
              title="One return needs approval"
              description="Basket value exceeded the automatic refund threshold"
            />
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
