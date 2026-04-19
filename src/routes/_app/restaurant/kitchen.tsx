import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/restaurant/kitchen')({
  component: KitchenBoardPage,
})

function KitchenBoardPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Kitchen board"
      title="Service coordination needs its own pace, hierarchy, and exception rail."
      description="The restaurant group stays separate so kitchen and table flows can expand without polluting the inventory or checkout surfaces."
      metrics={[
        {
          label: 'Live tickets',
          value: '31',
          hint: 'Across lunch and prep queues',
          tone: 'teal',
        },
        {
          label: 'Delayed items',
          value: '4',
          hint: 'Beyond target hold window',
          tone: 'amber',
        },
        {
          label: 'Prep stations',
          value: '6',
          hint: '2 stations above baseline load',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <WorkspacePanel
          eyebrow="Kitchen lanes"
          title="Prep, expo, and pickup stay in one service frame"
          description="A three-lane structure keeps the future board spatial without requiring oversized cards."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Prep', 'Ingredient staging, ticket batching, and timed mise en place.'],
              ['Expo', 'Order assembly, quality checks, and pass timing.'],
              ['Pickup', 'Runner coordination, packaging, and final handoff.'],
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
          eyebrow="Service pulse"
          title="Bottlenecks worth watching"
          description="The side rail holds the handful of moments that can slow service."
        >
          <div className="flex flex-col gap-3">
            {[
              ['06m', 'Expo queue rising', 'Three large baskets are converging on the pass'],
              ['09m', 'Prep station 2 over baseline', 'Cold side is carrying the lunch spike'],
              ['Now', 'Pickup runner delayed', 'One handoff is waiting on final packaging'],
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
