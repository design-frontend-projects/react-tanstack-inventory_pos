import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/pos/orders')({
  component: PosOrdersPage,
})

function PosOrdersPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Order queue"
      title="Track transaction flow in a compact queue, not a sprawling report."
      description="This screen is reserved for draft, open, completed, and refunded filters with exception handling close to the queue."
      metrics={[
        {
          label: 'Completed today',
          value: '286',
          hint: 'Across all active lanes',
          tone: 'red',
        },
        {
          label: 'Pending review',
          value: '6',
          hint: 'Discounts or manual overrides',
          tone: 'accent',
        },
        {
          label: 'Refunded',
          value: '3',
          hint: 'Below weekly average',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <WorkspacePanel
          eyebrow="Queue rail"
          title="Latest order states"
          description="The main queue stays narrow and fast to scan so exception resolution can live beside it."
        >
          <div className="flex flex-col gap-3">
            {[
              ['#24031', 'Order completed', 'Kasr El Nil · card payment reconciled'],
              ['#24032', 'Manual discount pending', 'Corniche Hot Line · manager approval needed'],
              ['#24033', 'Refund settled', 'Remote Test Counter · stock reversal posted'],
              ['#24034', 'Draft resumed', 'Kasr El Nil · split tender in progress'],
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
          eyebrow="Review gates"
          title="Exceptions beside the queue"
          description="Keep approval logic close to the transaction stream so operators can resolve issues without leaving the page."
        >
          <div className="grid gap-4">
            {[
              [
                'Discount override',
                'Two open baskets crossed the manual discount threshold and need sign-off.',
                'Manager review',
              ],
              [
                'Refund follow-up',
                'One refunded order is still waiting for tender confirmation from the lane.',
                'Tender audit',
              ],
              [
                'Shift close drift',
                'Cash drawer totals are trending away from the expected close variance band.',
                'Cash control',
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
