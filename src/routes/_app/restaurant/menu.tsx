import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/restaurant/menu')({
  component: MenuEngineeringPage,
})

function MenuEngineeringPage() {
  return (
    <WorkspacePage
      eyebrow="Menu engineering"
      title="Treat menu performance like a designed operating system."
      description="This route can hold contribution margin, item popularity, and bundle strategy once restaurant analytics are wired."
      metrics={[
        { label: 'Signature items', value: '18', hint: 'High velocity + high margin', tone: 'teal' },
        { label: 'Menu edits', value: '5', hint: 'Pending approval this week', tone: 'amber' },
        { label: 'Crossovers', value: '22', hint: 'Shared with POS catalog', tone: 'neutral' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Assortment performance"
        title="Keep the page analytical, not ornamental."
        description="This area is ready for contribution heatmaps and promotion controls."
      >
        <div className="rounded-[1.3rem] border border-border/60 bg-background/55 px-5 py-10 text-center text-sm text-muted-foreground">
          Menu contribution and item engineering placeholders.
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
