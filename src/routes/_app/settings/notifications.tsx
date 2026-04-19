import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/settings/notifications')({
  component: NotificationsSettingsPage,
})

function NotificationsSettingsPage() {
  return (
    <WorkspacePage
      eyebrow="Notifications"
      title="Browser alerts need governance, not just a permission toggle."
      description="This route prepares the shell for OneSignal registration, test delivery, and tenant-scoped notification events."
      metrics={[
        { label: 'Active subscriptions', value: '29', hint: 'Browser-level test fixture', tone: 'teal' },
        { label: 'Queued sends', value: '4', hint: 'Awaiting provider hook-up', tone: 'neutral' },
        { label: 'Denied browsers', value: '11', hint: 'Needs enablement campaign', tone: 'amber' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Delivery posture"
        title="Keep message control in an admin-grade surface."
        description="Use this page for permission banners, subscription syncing, and tenant-scoped alert testing."
      >
        <div className="rounded-[1.3rem] border border-border/60 bg-background/55 px-5 py-10 text-center text-sm text-muted-foreground">
          Notification permission and send-test controls placeholder.
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
