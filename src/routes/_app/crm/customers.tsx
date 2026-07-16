import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/crm/customers')({
  component: CrmCustomersPage,
})

function CrmCustomersPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Customer 360"
      title="Every customer relationship on one screen."
      description="This screen is reserved for the customer 360 view: profile, contacts, consent, tags, loyalty balance, segments, metrics, and the activity timeline — all read from CRM projections."
      metrics={[
        {
          label: 'Active customers',
          value: '—',
          hint: 'Lifecycle status: active',
          tone: 'red',
        },
        {
          label: 'At risk',
          value: '—',
          hint: 'No purchase in the at-risk window',
          tone: 'accent',
        },
        {
          label: 'VIP members',
          value: '—',
          hint: 'Top loyalty tier',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Profiles"
        title="Customer intelligence lives here"
        description="Search customers, open the 360 view, maintain contacts and consent, and add timeline notes once this screen is wired to the CRM server functions."
      >
        <div />
      </WorkspacePanel>
    </WorkspacePage>
  )
}
