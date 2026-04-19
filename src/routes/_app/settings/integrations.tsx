import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/settings/integrations')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  return (
    <WorkspacePage
      eyebrow="Integrations"
      title="External systems should read like controlled seams, not miscellaneous settings."
      description="This route is reserved for Supabase, maps, notifications, and tenant-level integration health."
      metrics={[
        { label: 'Connected services', value: '4', hint: 'Auth, DB, maps, messaging', tone: 'teal' },
        { label: 'Secrets exposed', value: '0', hint: 'Env template normalized in this pass', tone: 'neutral' },
        { label: 'Pending keys', value: '2', hint: 'Maps and OneSignal placeholders', tone: 'amber' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Integration seam"
        title="Server-only secrets and browser-safe keys now have a clear home."
        description="Continue this route with connection health, configuration validation, and provider-specific settings."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {['Supabase', 'Google Maps', 'OneSignal'].map((item) => (
            <div key={item} className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{item}</p>
              <p className="mt-2">Configuration placeholder.</p>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
