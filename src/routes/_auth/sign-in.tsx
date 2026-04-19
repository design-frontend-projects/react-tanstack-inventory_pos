import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ShieldCheck, Sparkles, Store } from 'lucide-react'
import { WorkspaceDetailCard } from '#/components/layout/workspace-page'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_auth/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
      <div className="ops-shell rounded-[2rem] px-6 py-7 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge
            variant="outline"
            className="rounded-full border-border/60 bg-background/60"
          >
            Demo access
          </Badge>
          <span className="ops-kicker">Modern enterprise control deck</span>
        </div>

        <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Sign in to a cleaner operating surface for inventory, service, sales,
          and admin control.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          The shell now centers search, workspace switching, and denser route
          surfaces. This entry point stays aligned with the app system instead
          of feeling like a separate marketing screen.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full px-5">
            <Link to="/dashboard">
              {t('actions.openDashboard')}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full px-5"
          >
            <Link to="/select-tenant">{t('actions.chooseWorkspace')}</Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Command search',
              description:
                'Routes, pages, and workspaces now share one top-bar surface.',
            },
            {
              title: 'Compact pages',
              description:
                'Secondary routes trade oversized headlines for faster scanning.',
            },
            {
              title: 'Unified shell',
              description:
                'Auth, public, and app surfaces now follow the same rhythm.',
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
          <span className="ops-kicker">System posture</span>
          <div className="mt-5 flex flex-col gap-4">
            {[
              {
                icon: ShieldCheck,
                title: 'Tenant-safe navigation',
                description:
                  'Command results resolve only to the internal route manifest or the active workspace list.',
              },
              {
                icon: Store,
                title: 'Workspace switching',
                description:
                  'Operators can move between tenants from the sidebar and the command surface.',
              },
              {
                icon: Sparkles,
                title: 'Theme and locale ready',
                description:
                  'Light, dark, and RTL-aware layout controls stay available across the whole product.',
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
  )
}
