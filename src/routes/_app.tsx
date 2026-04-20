import * as React from 'react'
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppShell } from '#/components/layout/app-shell'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const navigate = useNavigate()
  const {
    isPending,
    isAuthenticated,
    memberships,
    activeTenantId,
    context,
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

    if (!memberships.length) {
      return
    }

    if (needsProfileCompletion || context?.tenantStatus === 'invited') {
      void navigate({ to: '/complete-profile' })
      return
    }

    if (!activeTenantId) {
      void navigate({ to: '/select-tenant' })
    }
  }, [
    activeTenantId,
    context?.tenantStatus,
    isAuthenticated,
    isPending,
    memberships.length,
    navigate,
    needsProfileCompletion,
  ])

  if (isPending) {
    return <div className="min-h-[40vh] animate-pulse rounded-[1.5rem] border border-border/70 bg-card/60" />
  }

  if (!isAuthenticated || needsProfileCompletion || !activeTenantId) {
    return null
  }

  if (!memberships.length) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4">
        <section className="ops-panel rounded-[1.8rem] p-8 text-center">
          <p className="ops-kicker">Workspace access</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Your account is authenticated, but no tenant access is active yet.
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Ask a tenant administrator to invite you or reactivate your membership.
          </p>
        </section>
      </main>
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
