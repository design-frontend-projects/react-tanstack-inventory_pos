import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/restaurant/tables')({
  component: TableServicePage,
})

function TableServicePage() {
  return (
    <WorkspacePage
      eyebrow="Table service"
      title="Floor operations need a surface that reads in a single glance."
      description="Use this route for table state, server assignment, and pacing indicators."
      metrics={[
        { label: 'Occupied tables', value: '21', hint: 'Peak lunch seating', tone: 'teal' },
        { label: 'Turn targets missed', value: '3', hint: 'Requires floor manager input', tone: 'amber' },
        { label: 'Average dwell', value: '47m', hint: 'Within baseline', tone: 'neutral' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Floor state"
        title="Built for an eventual zone map."
        description="The UI leaves room for a spatial table grid or heatmap instead of defaulting to stacked cards."
      >
        <div className="grid gap-3 md:grid-cols-4">
          {['Zone A', 'Zone B', 'Terrace', 'Pickup'].map((zone) => (
            <div key={zone} className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{zone}</p>
              <p className="mt-2">Awaiting table-state integration.</p>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
