import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/settings/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Integrations"
      title="External systems should read like controlled seams, not miscellaneous settings."
      description="This route is reserved for Supabase, maps, notifications, and tenant-level integration health with server-safe boundaries."
      metrics={[
        {
          label: 'Connected services',
          value: '4',
          hint: 'Auth, DB, maps, messaging',
          tone: 'red',
        },
        {
          label: 'Secrets exposed',
          value: '0',
          hint: 'Env template normalized in this pass',
          tone: 'neutral',
        },
        {
          label: 'Pending keys',
          value: '2',
          hint: 'Maps and OneSignal placeholders',
          tone: 'accent',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <WorkspacePanel
          eyebrow="Integration seam"
          title="Service cards and configuration boundaries"
          description="Server-only secrets and browser-safe keys now have a clearer operational home."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Supabase', 'Auth, database access, and tenant-safe client boundaries.'],
              ['Google Maps', 'Outlet mapping, geocoding, and route overlays.'],
              ['OneSignal', 'Registration, subscription syncing, and browser delivery.'],
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
          eyebrow="Validation cadence"
          title="Each provider should pass a short health check"
          description="Provider status belongs in a compact validation rail rather than a miscellaneous settings page."
        >
          <div className="flex flex-col gap-3">
            {[
              ['ENV', 'Secret boundary check', 'Server-only values stay off the client bundle'],
              ['API', 'Key presence review', 'Browser-safe keys validated per provider'],
              ['TEST', 'Connection smoke', 'Run provider-specific health checks after setup'],
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
