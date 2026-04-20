import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/complete-profile')({
  component: CompleteProfileCompatibilityRedirect,
})

function CompleteProfileCompatibilityRedirect() {
  const navigate = Route.useNavigate()

  React.useEffect(() => {
    const search = typeof window === 'undefined' ? '' : window.location.search
    void navigate({
      to: '/complete-account',
      search: search ? (Object.fromEntries(new URLSearchParams(search)) as never) : undefined,
      replace: true,
    })
  }, [navigate])

  return <div className="min-h-[40vh] animate-pulse rounded-3xl border border-border/70 bg-card/60" />
}
