import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/settings/users')({
  component: SystemUsersPage,
})

function SystemUsersPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="System admin"
      title="Control access and roles without cluttering the rest of the product."
      description="System Admin sits apart from daily operations so access, alerts, and integrations read like controlled system surfaces."
      metrics={[
        {
          label: 'Active accounts',
          value: '84',
          hint: 'Across all demo tenants',
          tone: 'teal',
        },
        {
          label: 'Pending invites',
          value: '7',
          hint: 'Awaiting acceptance',
          tone: 'neutral',
        },
        {
          label: 'Privilege reviews',
          value: '2',
          hint: 'Needs owner approval',
          tone: 'amber',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <WorkspacePanel
          eyebrow="Access controls"
          title="Invite, role, and policy surfaces"
          description="Membership actions and permission reviews stay in a quieter control area away from operational dashboards."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <WorkspaceDetailCard
              title="Invite lane"
              description="Issue tenant-scoped invites, assign starter roles, and monitor acceptance state."
              meta="7 pending"
            />
            <WorkspaceDetailCard
              title="Role posture"
              description="Keep owner, admin, manager, cashier, and staff policies visible before an access change ships."
              meta="Policy guard"
            />
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Review cadence"
          title="Access changes in short steps"
          description="A compact approval sequence keeps sensitive access changes auditable."
        >
          <div className="flex flex-col gap-3">
            {[
              ['01', 'Invite created', 'Capture tenant, outlet, and starter role'],
              ['02', 'Acceptance verified', 'Confirm sign-in and default workspace mapping'],
              ['03', 'Privilege review', 'Escalate owner-level or cross-tenant access'],
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
