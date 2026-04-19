import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/settings/users')({
  component: SystemUsersPage,
})

function SystemUsersPage() {
  return (
    <WorkspacePage
      eyebrow="System admin"
      title="Control access and roles without cluttering the rest of the product."
      description="System Admin is a top-level sidebar group so security, notifications, and integrations stay clearly separated from operators’ daily flow."
      metrics={[
        { label: 'Active accounts', value: '84', hint: 'Across all demo tenants', tone: 'teal' },
        { label: 'Pending invites', value: '7', hint: 'Awaiting acceptance', tone: 'neutral' },
        { label: 'Privilege reviews', value: '2', hint: 'Needs owner approval', tone: 'amber' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Access posture"
        title="Users and roles belong in a quieter control area."
        description="This route is ready for membership tables, invite flows, and role-based permissions."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4 text-sm text-muted-foreground">
            Invite users, assign roles, and audit last-seen patterns.
          </div>
          <div className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4 text-sm text-muted-foreground">
            Keep user management away from the operational dashboards.
          </div>
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
