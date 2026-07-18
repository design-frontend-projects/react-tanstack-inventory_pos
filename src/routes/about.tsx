import { Link, createFileRoute } from '@tanstack/react-router'
import { Globe2, LayoutDashboard, SearchIcon, Store } from 'lucide-react'
import { WorkspaceDetailCard } from '#/components/layout/workspace-page'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl items-center px-4 py-6 md:px-8 md:py-8">
      <section className="grid w-full gap-6 xl:grid-cols-[1.14fr_0.86fr]">
        <div className="ops-shell rounded-[2rem] px-6 py-7 md:px-8 md:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge
              variant="outline"
              className="rounded-full border-border/60 bg-background/60"
            >
              About Bluewave
            </Badge>
            <span className="ops-kicker">Shared product system</span>
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
            A multitenant retail and restaurant shell built to feel fast,
            operational, and consistent across every surface.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            This starter combines TanStack Start, TanStack Router, shadcn/ui,
            Zustand, Prisma, and i18next into one control-deck baseline for
            inventory, restaurant, POS, and system administration workflows.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-5">
              <Link to="/sign-in">
                Open sign-in
                <SearchIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full px-5"
            >
              <Link to="/dashboard">View dashboard</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Shared navigation manifest',
                description:
                  'Sidebar, active section labels, and command results all resolve from one source of truth.',
              },
              {
                title: 'Enterprise page rhythm',
                description:
                  'Dashboard stays distinctive while secondary screens move to a denser compact system.',
              },
              {
                title: 'Locale and theme support',
                description:
                  'The shell respects light, dark, LTR, and RTL presentation without branching the UI.',
              },
            ].map(({ title, description }) => (
              <WorkspaceDetailCard
                key={title}
                title={title}
                description={description}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-6">
        <div className="ops-panel rounded-[1.7rem] p-6">
          <span className="ops-kicker">What the refresh changes</span>
          <div className="mt-5 flex flex-col gap-4">
            {[
              {
                icon: LayoutDashboard,
                title: 'Clearer shell hierarchy',
                description:
                  'A three-zone desktop header and lighter sidebar reduce friction on every route.',
              },
              {
                icon: SearchIcon,
                title: 'Top command surface',
                description:
                  'Navigation, pages, and workspaces now share a single searchable surface backed by an allowlist manifest.',
              },
              {
                icon: Store,
                title: 'Workspace-aware context',
                description:
                  'Tenant switching stays close to the shell instead of hiding inside route-specific controls.',
              },
              {
                icon: Globe2,
                title: 'RTL-ready labels',
                description:
                  'Header context, sidebar labels, and command groups now respect locale and direction.',
              },
            ].map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-3 rounded-[1.2rem] border border-border/65 bg-background/70 p-4"
                >
                  <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
