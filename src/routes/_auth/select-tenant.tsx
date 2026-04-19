import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'

export const Route = createFileRoute('/_auth/select-tenant')({
  component: SelectTenantPage,
})

function SelectTenantPage() {
  const navigate = Route.useNavigate()
  const { memberships, activeMembership, setActiveTenantId } = useSessionBootstrap()

  return (
    <section className="flex flex-col gap-6">
      <div className="ops-shell rounded-[2rem] px-6 py-8 md:px-8">
        <span className="ops-kicker">Workspace switch</span>
        <h1 className="ops-title mt-4 text-4xl md:text-6xl">
          Move between tenants without dropping your operating context.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
          The active workspace persists in local preferences and feeds the shell
          header, sidebar switcher, and future tenant-scoped data hooks.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {memberships.map((membership) => {
          const isActive = membership.tenantId === activeMembership.tenantId

          return (
            <article key={membership.tenantId} className="ops-panel rounded-[1.7rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{membership.tenantName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {membership.regionLabel}
                  </p>
                </div>
                <Badge variant={isActive ? 'default' : 'outline'} className="capitalize">
                  {membership.role}
                </Badge>
              </div>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Default outlet: {membership.defaultOutletLabel}
              </p>
              <Button
                className="mt-6 w-full rounded-full"
                variant={isActive ? 'secondary' : 'default'}
                onClick={() => {
                  setActiveTenantId(membership.tenantId)
                  void navigate({ to: '/dashboard' })
                }}
              >
                {isActive ? 'Continue inside workspace' : 'Enter workspace'}
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
