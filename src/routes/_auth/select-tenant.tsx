import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Building2, MapPinned, ShieldCheck } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'

export const Route = createFileRoute('/_auth/select-tenant')({
  component: SelectTenantPage,
})

function SelectTenantPage() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const { memberships, activeMembership, setActiveTenantId } = useSessionBootstrap()

  return (
    <section className="flex flex-col gap-6">
      <div className="ops-shell rounded-[2rem] px-6 py-7 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="ops-kicker">{t('actions.switchWorkspace')}</span>
          <Badge
            variant="outline"
            className="rounded-full border-border/60 bg-background/60"
          >
            {memberships.length} workspaces
          </Badge>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Move between tenants without losing your operational context.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          The active workspace now feeds the shell header, sidebar switcher, and
          top command surface. Each tenant card is tighter, clearer, and ready
          for future membership and outlet rules.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {memberships.map((membership) => {
          const isActive = membership.tenantId === activeMembership.tenantId

          return (
            <article
              key={membership.tenantId}
              className="ops-panel rounded-[1.7rem] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">
                      {membership.tenantName}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {membership.regionLabel}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isActive ? 'default' : 'outline'}
                  className="capitalize"
                >
                  {membership.role}
                </Badge>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-[1.1rem] border border-border/65 bg-background/72 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPinned className="text-muted-foreground" />
                    Primary outlet
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {membership.defaultOutletLabel}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-border/65 bg-background/72 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="text-muted-foreground" />
                    Workspace posture
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Ready for tenant-scoped navigation, locale-aware UI, and
                    shell persistence.
                  </p>
                </div>
              </div>

              <Button
                className="mt-6 w-full rounded-full"
                variant={isActive ? 'secondary' : 'default'}
                onClick={() => {
                  setActiveTenantId(membership.tenantId)
                  void navigate({ to: '/dashboard' })
                }}
              >
                {isActive
                  ? t('actions.continueInWorkspace')
                  : t('actions.enterWorkspace')}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
