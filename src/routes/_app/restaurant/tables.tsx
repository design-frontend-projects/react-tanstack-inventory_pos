import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/restaurant/tables')({
  component: TableServicePage,
})

function TableServicePage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Table service"
      title="Floor operations need a surface that reads in a single glance."
      description="Use this route for table state, server assignment, pacing indicators, and zone visibility without falling back to oversized card stacks."
      metrics={[
        {
          label: 'Occupied tables',
          value: '21',
          hint: 'Peak lunch seating',
          tone: 'red',
        },
        {
          label: 'Turn targets missed',
          value: '3',
          hint: 'Requires floor manager input',
          tone: 'accent',
        },
        {
          label: 'Average dwell',
          value: '47m',
          hint: 'Within baseline',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <WorkspacePanel
          eyebrow="Zone view"
          title="Built for a future floor map"
          description="The layout leaves room for a spatial zone grid or heatmap instead of defaulting to generic stacked cards."
        >
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Zone A', 'High-turn lunch seating'],
              ['Zone B', 'Family tables and slower ticket flow'],
              ['Terrace', 'Weather-sensitive service pacing'],
              ['Pickup', 'Counter handoff and waiting queue'],
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
          title="Pacing notes for the floor lead"
          description="A compact side rail keeps table turns and staffing cues within sight."
        >
          <div className="flex flex-col gap-3">
            {[
              ['12m', 'Terrace wait lengthening', 'One section is approaching the target dwell ceiling'],
              ['4', 'Open resets', 'Four tables are ready for the next seating wave'],
              ['Now', 'Server handoff', 'Zone B needs a short staff rebalance'],
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
