import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/crm/segments')({
  component: CrmSegmentsPage,
})

function CrmSegmentsPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Segmentation"
      title="Audiences that keep themselves current."
      description="This screen is reserved for declarative segment rules over customer facts — membership updates automatically as business events fold into the metrics projection."
      metrics={[
        {
          label: 'Active segments',
          value: '—',
          hint: 'Rule-based audiences',
          tone: 'teal',
        },
        {
          label: 'Largest segment',
          value: '—',
          hint: 'By member count',
          tone: 'neutral',
        },
        {
          label: 'Last rebuild',
          value: '—',
          hint: 'Full membership recompute',
          tone: 'amber',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Rules"
        title="Define once, membership stays fresh"
        description="Create segments like VIPs, high spenders, or customers inactive for 90 days; enter/exit transitions show on each customer timeline."
      >
        <div />
      </WorkspacePanel>
    </WorkspacePage>
  )
}
