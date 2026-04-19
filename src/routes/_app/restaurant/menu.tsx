import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/restaurant/menu')({
  component: MenuEngineeringPage,
})

function MenuEngineeringPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Menu engineering"
      title="Treat menu performance like an operating system for margin, demand, and service speed."
      description="This route is reserved for contribution margin, item popularity, bundle strategy, and the publishing controls behind every menu revision."
      metrics={[
        {
          label: 'Signature items',
          value: '18',
          hint: 'High velocity + high margin',
          tone: 'teal',
        },
        {
          label: 'Menu edits',
          value: '5',
          hint: 'Pending approval this week',
          tone: 'amber',
        },
        {
          label: 'Crossovers',
          value: '22',
          hint: 'Shared with POS catalog',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <WorkspacePanel
          eyebrow="Performance frame"
          title="Signature, filler, and test lanes"
          description="The page stays analytical so item performance and menu changes feel operational, not decorative."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Signature lane', 'Protect high-margin, high-velocity items from accidental edits.'],
              ['Repair lane', 'Watch low-margin items that still carry demand or labor load.'],
              ['Test lane', 'Bundle experiments and limited-time offers before approval.'],
            ].map(([title, description]) => (
              <WorkspaceDetailCard
                key={title}
                title={title}
                description={description}
              />
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Release rhythm"
          title="Menu edits should move in short, visible steps"
          description="Promotion and price changes can sit in a side rail before the next rollout window."
        >
          <div className="flex flex-col gap-3">
            {[
              ['Plan', 'Margin review', 'Check contribution before changing price or placement'],
              ['Draft', 'Item revision', 'Stage copy, channel visibility, and bundle rules'],
              ['Ship', 'Menu release', 'Publish into the next approved service window'],
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
      </div>
    </WorkspacePage>
  )
}
