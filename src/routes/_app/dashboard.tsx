import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  CreditCard,
  PackageSearch,
  ScanLine,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { WorkspacePage } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

type Trend = 'up' | 'down'

function PinShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`pin-card p-5 ${className ?? ''}`}>{children}</section>
  )
}

function PinLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="ops-panel-label">{children}</span>
    </div>
  )
}

function KpiPin({
  icon,
  label,
  value,
  delta,
  trend,
  caption,
}: {
  icon: LucideIcon
  label: string
  value: string
  delta: string
  trend: Trend
  caption: string
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <PinShell>
      <PinLabel icon={icon}>{label}</PinLabel>
      <div className="mt-5 flex items-end justify-between gap-3">
        <strong className="text-4xl font-bold tracking-tight">{value}</strong>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
            trend === 'up'
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <TrendIcon className="size-3.5" />
          {delta}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</p>
    </PinShell>
  )
}

function DashboardPage() {
  return (
    <WorkspacePage
      variant="hero"
      eyebrow="Command surface"
      title="A tighter operating picture for inventory, service, sales, and admin control."
      description="One briefing surface for the live posture, one action ribbon for exceptions, and one cadence rail for the day ahead."
      metrics={[
        {
          label: 'Live outlets',
          value: '12',
          hint: '3 tenants across 2 cities',
          tone: 'red',
        },
        {
          label: 'At-risk SKUs',
          value: '19',
          hint: 'Threshold breaches in the next 6 hours',
          tone: 'accent',
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
          <Button asChild size="lg">
            <Link to="/inventory">Open inventory board</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/pos">Jump to checkout</Link>
          </Button>
        </>
      }
    >
      <div className="pin-masonry-wide">
        <KpiPin
          icon={CreditCard}
          label="Today's revenue"
          value="EGP 84.2k"
          delta="12.4%"
          trend="up"
          caption="Ahead of the trailing 7-day average across all outlets."
        />

        <KpiPin
          icon={ClipboardList}
          label="Orders"
          value="1,284"
          delta="3.1%"
          trend="up"
          caption="POS and delivery combined, settled and in-flight."
        />

        {/* Priority ribbon — taller pin */}
        <PinShell>
          <PinLabel icon={TriangleAlert}>Priority ribbon</PinLabel>
          <div className="mt-4 flex flex-col gap-3">
            {[
              [
                'Kasr El Nil',
                'Cold storage variance in the receiving bay.',
                '02:14 ago',
              ],
              [
                'Corniche Hot Line',
                'Prep queue running above lunch baseline.',
                '06 min',
              ],
              [
                'Remote Test Counter',
                'Notification webhook waiting for sign-off.',
                'Now',
              ],
            ].map(([title, body, meta]) => (
              <div
                key={title}
                className="rounded-lg border border-border bg-muted/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{title}</p>
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-primary">
                    {meta}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </PinShell>

        <KpiPin
          icon={PackageSearch}
          label="Avg. ticket"
          value="EGP 65.6"
          delta="1.8%"
          trend="down"
          caption="Slightly softer basket size versus yesterday."
        />

        {/* Low stock pin */}
        <PinShell>
          <PinLabel icon={Boxes}>Low stock watch</PinLabel>
          <div className="mt-4 flex flex-col gap-2.5">
            {[
              ['Arabica beans 1kg', '8 left', 'critical'],
              ['Oat milk 1L', '14 left', 'low'],
              ['Takeaway cups 12oz', '31 left', 'low'],
              ['Vanilla syrup 750ml', '5 left', 'critical'],
            ].map(([name, qty, level]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate">{name}</span>
                <Badge
                  variant={level === 'critical' ? 'destructive' : 'secondary'}
                  className="shrink-0"
                >
                  {qty}
                </Badge>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <Link to="/inventory">Review reorder list</Link>
          </Button>
        </PinShell>

        {/* Cadence rail */}
        <PinShell>
          <PinLabel icon={ClipboardList}>Today at a glance</PinLabel>
          <div className="mt-4 flex flex-col gap-3">
            {[
              ['07:30', 'Morning stock verification', 'Inventory'],
              ['12:00', 'Lunch service monitoring', 'Restaurant'],
              ['15:00', 'Cash drawer reconciliation', 'POS'],
              ['18:00', 'Notification delivery audit', 'System'],
            ].map(([time, task, domain]) => (
              <div key={time} className="flex items-center gap-4">
                <div className="min-w-14 text-sm font-bold tabular-nums text-primary">
                  {time}
                </div>
                <div className="flex-1 border-s border-border ps-4">
                  <p className="text-sm font-medium">{task}</p>
                  <p className="text-xs text-muted-foreground">{domain}</p>
                </div>
              </div>
            ))}
          </div>
        </PinShell>

        {/* Quick actions */}
        <PinShell>
          <PinLabel icon={ScanLine}>Quick actions</PinLabel>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="justify-start"
            >
              <Link to="/pos">New sale</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="justify-start"
            >
              <Link to="/inventory">Receive stock</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="justify-start"
            >
              <Link to="/pos/returns">Process return</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="justify-start"
            >
              <Link to="/outlets">Open outlets</Link>
            </Button>
          </div>
        </PinShell>
      </div>
    </WorkspacePage>
  )
}
