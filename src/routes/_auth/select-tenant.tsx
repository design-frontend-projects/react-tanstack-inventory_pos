import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'

export const Route = createFileRoute('/_auth/select-tenant')({
  component: SelectTenantPage,
})

function SelectTenantPage() {
  const navigate = Route.useNavigate()
  const {
    isPending,
    isAuthenticated,
    memberships,
    activeMembership,
    setActiveTenantId,
    needsProfileCompletion,
  } = useSessionBootstrap()

  React.useEffect(() => {
    if (isPending) {
      return
    }

    if (!isAuthenticated) {
      void navigate({ to: '/sign-in' })
      return
    }

    if (needsProfileCompletion) {
      void navigate({ to: '/complete-account' })
      return
    }

    if (memberships.length <= 1 && activeMembership?.tenantId) {
      void navigate({ to: '/dashboard' })
    }
  }, [
    activeMembership?.tenantId,
    isAuthenticated,
    isPending,
    memberships.length,
    navigate,
    needsProfileCompletion,
  ])

  if (isPending) {
    return <div className="min-h-[40vh] animate-pulse rounded-3xl border border-border/70 bg-card/60" />
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="ops-shell rounded-4xl px-6 py-7 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="ops-kicker">Workspace selection</span>
          <Badge
            variant="outline"
            className="rounded-full border-border/60 bg-background/60"
          >
            {memberships.length} workspaces
          </Badge>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Choose the tenant context you want to operate in.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          The selected workspace is persisted on the server and reflected back into
          the shell, route guards, and permission checks.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {memberships.map((membership) => {
          const isActive = membership.tenantId === activeMembership?.tenantId

          return (
            <Card
              key={membership.tenantId}
              className="ops-panel rounded-[1.7rem] border-border/65 p-5"
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
                      {membership.roleLabel}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isActive ? 'default' : 'outline'}
                  className="capitalize"
                >
                  {membership.status}
                </Badge>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-[1.1rem] border border-border/65 bg-background/72 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="text-muted-foreground" />
                    Access posture
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {membership.status === 'active'
                      ? 'This workspace is active and ready for tenant-scoped actions.'
                      : 'This workspace is pending or restricted and cannot be opened yet.'}
                  </p>
                </div>
              </div>

              <Button
                className="mt-6 w-full rounded-full"
                variant={isActive ? 'secondary' : 'default'}
                disabled={membership.status !== 'active'}
                onClick={() => {
                  void setActiveTenantId(membership.tenantId).then(() => {
                    void navigate({ to: '/dashboard' })
                  })
                }}
              >
                {isActive ? 'Continue' : 'Enter workspace'}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
