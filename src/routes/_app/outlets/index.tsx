import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/outlets/')({
  component: OutletsPage,
})

function OutletsPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Outlets"
      title="Keep outlet context attached to stock, service, and fulfillment decisions."
      description="This route stays inside the inventory group so location coverage, map state, and dispatch posture remain connected."
      metrics={[
        {
          label: 'Mapped outlets',
          value: '12',
          hint: '9 active + 3 pilot',
          tone: 'teal',
        },
        {
          label: 'Timezone splits',
          value: '3',
          hint: 'Useful for dispatch and reports',
          tone: 'neutral',
        },
        {
          label: 'Missing coords',
          value: '1',
          hint: 'Needs geocoding completion',
          tone: 'amber',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <WorkspacePanel
          eyebrow="Coverage map"
          title="Map and list views stay in one operational frame"
          description="A future Google Maps surface can sit beside filters and outlet cards without pushing the page back into a dashboard mosaic."
        >
          <WorkspaceEmptyState
            title="Map canvas placeholder"
            description="Connect outlet markers, service coverage, and geo-aware filters here. Keep the canvas large enough for routing and dispatch overlays."
            className="min-h-72"
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Coverage notes"
          title="Location posture"
          description="A compact side rail keeps rollout, health, and geo gaps easy to scan."
        >
          <div className="grid gap-4">
            <WorkspaceDetailCard
              title="Kasr El Nil Flagship"
              description="Primary city hub with full stock, POS, and restaurant coverage."
              meta="Tier 1"
            />
            <WorkspaceDetailCard
              title="Corniche Hot Line"
              description="North cluster pilot with dispatch-heavy demand and tight prep windows."
              meta="Tier 2"
            />
            <WorkspaceTimelineItem
              leading="Geo"
              title="One branch needs final coordinates"
              description="Complete geocoding before maps and radius filtering ship"
            />
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
