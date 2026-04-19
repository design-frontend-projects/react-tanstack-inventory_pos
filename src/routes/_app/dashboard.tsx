import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <WorkspacePage
      eyebrow="Command surface"
      title="A single operating picture for stock, service, sales, and admin control."
      description="The dashboard emphasizes direction over clutter: one broad briefing panel, one tactical column, and grouped routes that let each domain expand without collapsing into card soup."
      metrics={[
        { label: 'Live outlets', value: '12', hint: '3 tenants across 2 cities', tone: 'teal' },
        { label: 'At-risk SKUs', value: '19', hint: 'Threshold breaches in the next 6 hours', tone: 'amber' },
        { label: 'Open service slips', value: '47', hint: 'Kitchen + POS queue combined', tone: 'neutral' },
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
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <WorkspacePanel
          eyebrow="Priority ribbon"
          title="What needs attention before the next rush."
          description="Each line is terse on purpose. Operators should understand the situation by scanning headings and numbers first."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Kasr El Nil', 'Cold storage variance detected', '02:14 ago'],
              ['Corniche Hot Line', 'Delivery prep queue above baseline', '06 min'],
              ['Remote Test Counter', 'Notification webhook pending approval', 'Now'],
            ].map(([title, body, stamp]) => (
              <div key={title} className="rounded-[1.3rem] border border-border/60 bg-background/55 p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {stamp}
                </p>
              </div>
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Cadence"
          title="Today at a glance."
          description="A narrow tactical rail keeps the dashboard calm while still showing the rhythm of operations."
        >
          <div className="flex flex-col gap-3">
            {[
              ['07:30', 'Morning stock verification', 'Inventory'],
              ['12:00', 'Lunch service monitoring', 'Restaurant'],
              ['15:00', 'Cash drawer reconciliation', 'POS'],
              ['18:00', 'Notification delivery audit', 'System'],
            ].map(([time, task, domain]) => (
              <div key={time} className="flex items-center gap-4 rounded-[1.2rem] border border-border/60 bg-background/50 px-4 py-3">
                <div className="min-w-14 text-sm font-semibold">{time}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{task}</p>
                  <p className="text-xs text-muted-foreground">{domain}</p>
                </div>
              </div>
            ))}
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}
