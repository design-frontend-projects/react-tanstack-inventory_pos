import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/restaurant/kitchen')({
  component: KitchenBoardPage,
})

function KitchenBoardPage() {
  return (
    <WorkspacePage
      eyebrow="Kitchen board"
      title="Service coordination deserves its own pace and hierarchy."
      description="The restaurant group is kept separate so kitchen and table flows can expand without polluting the inventory or POS surfaces."
      metrics={[
        { label: 'Live tickets', value: '31', hint: 'Across lunch and prep queues', tone: 'teal' },
        { label: 'Delayed items', value: '4', hint: 'Beyond target hold window', tone: 'amber' },
        { label: 'Prep stations', value: '6', hint: '2 stations above baseline load', tone: 'neutral' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Line of fire"
        title="This route is ready for kitchen swim lanes."
        description="Use this page for expo visibility, prep timers, and service bottlenecks."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {['Prep', 'Expo', 'Pickup'].map((lane) => (
            <div key={lane} className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4">
              <p className="text-sm font-semibold">{lane}</p>
              <p className="mt-2 text-sm text-muted-foreground">Lane placeholder.</p>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
