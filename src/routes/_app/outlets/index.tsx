import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/outlets/')({
  component: OutletsPage,
})

function OutletsPage() {
  return (
    <WorkspacePage
      eyebrow="Outlets"
      title="Keep location context attached to every operational decision."
      description="This route is already positioned under the inventory group so map, stock, and fulfillment views can stay connected."
      metrics={[
        { label: 'Mapped outlets', value: '12', hint: '9 active + 3 pilot', tone: 'teal' },
        { label: 'Timezone splits', value: '3', hint: 'Useful for dispatch and reports', tone: 'neutral' },
        { label: 'Missing coords', value: '1', hint: 'Needs geocoding completion', tone: 'amber' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Location module"
        title="Map and list surfaces belong in the same visual family."
        description="A reusable Google Maps module can slot into this page without forcing the rest of the layout into dashboard-card patterns."
      >
        <div className="rounded-[1.3rem] border border-dashed border-border/80 bg-background/50 px-5 py-10 text-center text-sm text-muted-foreground">
          Map canvas placeholder: connect outlet markers and location filters here.
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
