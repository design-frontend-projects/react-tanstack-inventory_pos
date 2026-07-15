import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/settings/notifications')({
  component: NotificationsSettingsPage,
})

function NotificationsSettingsPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Notifications"
      title="Browser alerts need governance, not just a permission toggle."
      description="This route prepares the shell for OneSignal registration, test delivery, and tenant-scoped event routing."
      metrics={[
        {
          label: 'Active subscriptions',
          value: '29',
          hint: 'Browser-level test fixture',
          tone: 'teal',
        },
        {
          label: 'Queued sends',
          value: '4',
          hint: 'Awaiting provider hook-up',
          tone: 'neutral',
        },
        {
          label: 'Denied browsers',
          value: '11',
          hint: 'Needs enablement campaign',
          tone: 'amber',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <WorkspacePanel
          eyebrow="Delivery posture"
          title="Permission, subscription, and test-send controls"
          description="Message controls belong in an admin-grade surface with the queue and audit details nearby."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <WorkspaceDetailCard
              title="Permission campaigns"
              description="Track denied browsers and plan tenant-specific re-enable flows."
              meta="11 browsers"
            />
            <WorkspaceDetailCard
              title="Subscription sync"
              description="Keep browser tokens aligned with tenant membership and device state."
              meta="29 active"
            />
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Send test"
          title="Notification audit lane"
          description="A single side rail keeps test delivery and provider health compact."
        >
          <div className="flex flex-col gap-3">
            <WorkspaceEmptyState
              title="Permission and send-test controls"
              description="Use this well for browser registration checks, test sends, and provider health notes."
            />
            <WorkspaceTimelineItem
              leading="4"
              title="Queued sends waiting on provider hookup"
              description="The shell is ready for OneSignal once credentials land"
            />
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
