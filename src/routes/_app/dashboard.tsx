import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <WorkspacePage
      variant="hero"
      eyebrow="Command surface"
      title="A tighter operating picture for inventory, service, sales, and admin control."
      description="The dashboard now behaves like a command deck: one briefing surface for the live posture, one action ribbon for exceptions, and one cadence rail for the day ahead."
      metrics={[
        {
          label: 'Live outlets',
          value: '12',
          hint: '3 tenants across 2 cities',
          tone: 'teal',
        },
        {
          label: 'At-risk SKUs',
          value: '19',
          hint: 'Threshold breaches in the next 6 hours',
          tone: 'amber',
        },
        {
          label: 'Open service slips',
          value: '47',
          hint: 'Kitchen + POS queue combined',
          tone: 'neutral',
        },
      ]}
      actions={
        <>
          <Button asChild size="lg" className="rounded-full px-5">
            <Link to="/inventory">Open inventory board</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-5">
            <Link to="/pos">Jump to checkout</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <WorkspacePanel
          eyebrow="Priority ribbon"
          title="What needs attention before the next rush."
          description="Each callout is short on purpose. Operators should be able to scan location, issue, and timing in one sweep."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                'Kasr El Nil',
                'Cold storage variance detected in the receiving bay.',
                '02:14 ago',
              ],
              [
                'Corniche Hot Line',
                'Delivery prep queue is running above the lunch baseline.',
                '06 min',
              ],
              [
                'Remote Test Counter',
                'Notification webhook is waiting for sign-off.',
                'Now',
              ],
            ].map(([title, body, meta]) => (
              <WorkspaceDetailCard
                key={title}
                title={title}
                description={body}
                meta={meta}
              />
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Cadence"
          title="Today at a glance."
          description="A narrow tactical rail keeps the dashboard calm while still showing the rhythm of the floor."
        >
          <div className="flex flex-col gap-3">
            {[
              ['07:30', 'Morning stock verification', 'Inventory'],
              ['12:00', 'Lunch service monitoring', 'Restaurant'],
              ['15:00', 'Cash drawer reconciliation', 'POS'],
              ['18:00', 'Notification delivery audit', 'System'],
            ].map(([time, task, domain]) => (
              <WorkspaceTimelineItem
                key={time}
                leading={time}
                title={task}
                description={domain}
              />
            ))}
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
