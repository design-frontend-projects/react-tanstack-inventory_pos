import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { getAccessToken } from '#/features/auth/browser-auth'
import {
  acceptInvitationServerFn,
  completeOwnerOnboardingServerFn,
} from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  getPasswordPolicyDescription,
  invitationAcceptanceSchema,
  ownerOnboardingSchema,
} from '#/features/auth/validation'
import type { CompletionFlowContext } from '#/types/auth'

type CompleteAccountRedirectState = {
  activeTenantId: string | null
  isAuthenticated: boolean
  needsAccountCompletion: boolean
  needsTenantSelection: boolean
}

function readCompletionFlowFromSearch(): CompletionFlowContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const flow = params.get('flow')
  const registrationId = params.get('registrationId')
  const invitationId = params.get('invitationId')

  if (flow !== 'owner' && flow !== 'invite') {
    return null
  }

  return {
    flow,
    registrationId,
    invitationId,
  }
}

function resolveCompleteAccountRedirect({
  activeTenantId,
  isAuthenticated,
  needsAccountCompletion,
  needsTenantSelection,
}: CompleteAccountRedirectState) {
  if (!isAuthenticated) {
    return '/sign-in' as const
  }

  if (needsAccountCompletion) {
    return null
  }

  if (activeTenantId) {
    return '/dashboard' as const
  }

  if (needsTenantSelection) {
    return '/select-tenant' as const
  }

  return null
}

export function CompleteAccountPage() {
  const navigate = useNavigate()
  const session = useSessionBootstrap()
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [searchFlow] = React.useState(readCompletionFlowFromSearch)
  const completionFlow = searchFlow ?? session.completionFlow
  const [form, setForm] = React.useState({
    tenantName: '',
    timezone:
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        : 'UTC',
    firstName: '',
    lastName: '',
    phone: '',
    avatarUrl: '',
    password: '',
    confirmPassword: '',
  })

  const isOwnerFlow = completionFlow?.flow === 'owner'
  const redirectTarget = !completionFlow
    ? resolveCompleteAccountRedirect({
        activeTenantId: session.activeTenantId,
        isAuthenticated: session.isAuthenticated,
        needsAccountCompletion: session.needsAccountCompletion,
        needsTenantSelection: session.needsTenantSelection,
      })
    : null

  React.useEffect(() => {
    if (!session.user) {
      return
    }

    setForm((current) => ({
      ...current,
      firstName: current.firstName || session.user?.firstName || '',
      lastName: current.lastName || session.user?.lastName || '',
      phone: current.phone || session.user?.phone || '',
      avatarUrl: current.avatarUrl || session.user?.avatarUrl || '',
    }))
  }, [session.user])

  React.useEffect(() => {
    if (session.isPending || !redirectTarget) {
      return
    }

    void navigate({ to: redirectTarget })
  }, [navigate, redirectTarget, session.isPending])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setError('A valid signed-in session is required before the account can be completed.')
      return
    }

    setIsSubmitting(true)

    try {
      if (!completionFlow) {
        throw new Error('No completion flow was provided for this account.')
      }

      if (completionFlow.flow === 'owner' && completionFlow.registrationId) {
        const parsedForm = ownerOnboardingSchema.safeParse({
          registrationId: completionFlow.registrationId,
          tenantName: form.tenantName,
          timezone: form.timezone,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          avatarUrl: form.avatarUrl,
          password: form.password,
          confirmPassword: form.confirmPassword,
        })

        if (!parsedForm.success) {
          throw new Error(parsedForm.error.issues[0]?.message ?? 'Review the account form.')
        }

        const result = await completeOwnerOnboardingServerFn({
          data: {
            accessToken,
            ...parsedForm.data,
          },
        })

        await session.setActiveTenantId(result.tenantId)
        void navigate({ to: '/dashboard' })
        return
      }

      if (completionFlow.flow === 'invite' && completionFlow.invitationId) {
        const parsedForm = invitationAcceptanceSchema.safeParse({
          invitationId: completionFlow.invitationId,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          avatarUrl: form.avatarUrl,
          password: form.password,
          confirmPassword: form.confirmPassword,
        })

        if (!parsedForm.success) {
          throw new Error(parsedForm.error.issues[0]?.message ?? 'Review the account form.')
        }

        const result = await acceptInvitationServerFn({
          data: {
            accessToken,
            ...parsedForm.data,
          },
        })

        await session.setActiveTenantId(result.tenantId)
        void navigate({ to: '/dashboard' })
        return
      }

      throw new Error('No completion flow was provided for this account.')
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to complete the account.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (session.isPending) {
    return <div className="min-h-[40vh] animate-pulse rounded-3xl border border-border/70 bg-card/60" />
  }

  if (!session.isAuthenticated) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="ops-panel rounded-[1.8rem] border-border/65 p-6 md:p-7">
          <p className="ops-kicker">Verified session required</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Open the latest email link before completing this account.
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Account completion only works after Supabase establishes the verified
            session from the owner or invitation email link.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="rounded-full" onClick={() => void navigate({ to: '/sign-in' })}>
              Go to sign in
            </Button>
          </div>
        </Card>
      </section>
    )
  }

  if (!completionFlow) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="ops-panel rounded-[1.8rem] border-border/65 p-6 md:p-7">
          <p className="ops-kicker">Completion flow</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            No account completion context is attached to this session.
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Open the latest owner or invitation email link, or ask a tenant
            administrator to confirm that this account has access to a workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="rounded-full" onClick={() => void navigate({ to: '/sign-in' })}>
              Go to sign in
            </Button>
            {session.activeTenantId ? (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => void navigate({ to: '/dashboard' })}
              >
                Open dashboard
              </Button>
            ) : null}
          </div>
        </Card>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="ops-shell rounded-4xl px-6 py-8 md:px-8 md:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="ops-kicker">
              {isOwnerFlow ? 'Owner onboarding' : 'Invitation acceptance'}
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
              {isOwnerFlow
                ? 'Finish the owner account, create the tenant, and set the password.'
                : 'Link the invitation to this account and activate the tenant membership.'}
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
              {isOwnerFlow
                ? 'This step persists the verified owner profile, provisions the tenant, marks onboarding complete, and sets the default workspace.'
                : 'This step validates the invitation lifecycle, links the current auth user to the tenant membership, and applies the assigned primary role.'}
            </p>
          </div>

          <div className="min-w-60 rounded-[1.4rem] border border-border/65 bg-background/70 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" />
              Password policy
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {getPasswordPolicyDescription()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="ops-panel rounded-[1.8rem] border-border/65 p-6 md:p-7">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRoundCheck />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {isOwnerFlow ? 'Owner setup' : 'Invitation setup'}
              </p>
              <p className="text-sm text-muted-foreground">
                Signed in as {session.user?.email ?? 'your account'}
              </p>
            </div>
          </div>

          <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
            {isOwnerFlow ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={form.tenantName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, tenantName: event.target.value }))
                  }
                  placeholder="Tenant name"
                />
                <Input
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, timezone: event.target.value }))
                  }
                  placeholder="Timezone"
                />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                value={form.firstName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, firstName: event.target.value }))
                }
                placeholder="First name"
                autoComplete="given-name"
              />
              <Input
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, lastName: event.target.value }))
                }
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="Phone"
                autoComplete="tel"
              />
              <Input
                value={form.avatarUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, avatarUrl: event.target.value }))
                }
                placeholder="Avatar URL"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder={isOwnerFlow ? 'Create password' : 'Set password (optional)'}
                autoComplete="new-password"
              />
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Confirm password"
                autoComplete="new-password"
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border/65 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted-foreground">
                {isOwnerFlow
                  ? 'The tenant is created only after this verified session completes successfully.'
                  : 'Password is optional here if this account already maintains a password.'}
              </p>

              <Button
                type="submit"
                className="rounded-full sm:min-w-44"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {isOwnerFlow ? 'Create tenant workspace' : 'Accept invitation'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="rounded-[1.8rem] border-border/65 bg-card/80 p-6 md:p-7">
          <p className="ops-kicker">What happens next</p>
          <div className="mt-4 grid gap-4">
            {(isOwnerFlow
              ? [
                  'Profile and password are finalized against the verified owner identity.',
                  'The tenant account is created with activity, timezone, and owner membership.',
                  'The new workspace becomes the default tenant and opens directly.',
                ]
              : [
                  'The invitation is checked for status, expiry, and identity ownership.',
                  'The tenant membership is activated and linked to this authenticated user.',
                  'Primary role permissions plus any future direct overrides become effective.',
                ]
            ).map((body, index) => (
              <div
                key={body}
                className="rounded-[1.2rem] border border-border/65 bg-background/70 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm font-semibold">Step {index + 1}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  )
}
