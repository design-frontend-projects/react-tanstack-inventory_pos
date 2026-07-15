import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn, MailCheck, ShieldCheck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { requestSignInOtp, verifySignInOtp } from '#/features/auth/browser-auth'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  signInOtpRequestSchema,
  signInOtpVerifySchema,
} from '#/features/auth/validation'
import type { SessionBootstrapPayload } from '#/types/auth'

type SignInStep = 'request' | 'verify'

type SignInRedirectState = {
  activeTenantId: string | null
  isAuthenticated: boolean
  membershipsCount: number
  needsProfileCompletion: boolean
}

function getNeedsProfileCompletion(
  session: SessionBootstrapPayload | undefined,
) {
  return (
    session?.authenticated === true &&
    session.user !== null &&
    (!session.user.profileCompleted ||
      !session.user.onboardingCompleted ||
      session.activeMembership?.status === 'invited')
  )
}

function resolveSignInRedirect({
  activeTenantId,
  isAuthenticated,
  membershipsCount,
  needsProfileCompletion,
}: SignInRedirectState) {
  if (!isAuthenticated) {
    return null
  }

  if (needsProfileCompletion) {
    return '/complete-account' as const
  }

  if (!membershipsCount) {
    return null
  }

  if (!activeTenantId && membershipsCount > 1) {
    return '/select-tenant' as const
  }

  return '/dashboard' as const
}

export function SignInPage() {
  const navigate = useNavigate()
  const session = useSessionBootstrap()
  const [step, setStep] = React.useState<SignInStep>('request')
  const [email, setEmail] = React.useState('')
  const [token, setToken] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const redirectTarget = resolveSignInRedirect({
    activeTenantId: session.activeTenantId,
    isAuthenticated: session.isAuthenticated,
    membershipsCount: session.memberships.length,
    needsProfileCompletion: session.needsProfileCompletion,
  })

  React.useEffect(() => {
    if (redirectTarget) {
      void navigate({ to: redirectTarget })
    }
  }, [navigate, redirectTarget])

  function resetFeedback() {
    setError(null)
    setSuccessMessage(null)
  }

  async function submitOtpRequest() {
    resetFeedback()

    const parsedEmail = signInOtpRequestSchema.safeParse({
      email,
    })

    if (!parsedEmail.success) {
      setError(
        parsedEmail.error.issues[0]?.message ?? 'Enter a valid email address.',
      )
      return
    }

    setIsSubmitting(true)

    const { error: otpRequestError } = await requestSignInOtp(
      parsedEmail.data.email,
    )

    setIsSubmitting(false)

    if (otpRequestError) {
      setError(otpRequestError.message)
      return
    }

    setEmail(parsedEmail.data.email)
    setToken('')
    setStep('verify')
    setSuccessMessage(
      `Enter the 6-digit code sent to ${parsedEmail.data.email}.`,
    )
  }

  async function handleRequestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitOtpRequest()
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetFeedback()

    const parsedOtp = signInOtpVerifySchema.safeParse({
      email,
      token,
    })

    if (!parsedOtp.success) {
      setError(parsedOtp.error.issues[0]?.message ?? 'Enter the 6-digit code.')
      return
    }

    setIsSubmitting(true)

    const { error: verifyError } = await verifySignInOtp(
      parsedOtp.data.email,
      parsedOtp.data.token,
    )

    if (verifyError) {
      setIsSubmitting(false)
      setError(verifyError.message)
      return
    }

    setSuccessMessage('Code verified. Loading your workspace...')

    const nextSession = await session.refetch()
    console.log('next session: ', nextSession)
    const nextTarget = resolveSignInRedirect({
      activeTenantId: nextSession.data?.activeTenantId ?? null,
      isAuthenticated: nextSession.data?.authenticated ?? false,
      membershipsCount: nextSession.data?.memberships.length ?? 0,
      needsProfileCompletion: getNeedsProfileCompletion(nextSession.data),
    })

    setIsSubmitting(false)

    if (nextTarget) {
      void navigate({ to: nextTarget })
      return
    }

    if (nextSession.data?.authenticated) {
      setSuccessMessage(
        'Code verified. You are signed in, but no tenant workspace is active yet.',
      )
    }
  }

  function handleUseDifferentEmail() {
    setStep('request')
    setToken('')
    resetFeedback()
  }

  const isVerifyStep = step === 'verify'

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="ops-shell rounded-4xl px-6 py-8 md:px-8 md:py-9">
        <p className="ops-kicker">Authentication foundation</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
          Sign in with email OTP and let the server resolve the tenant context.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
          Standard sign-in now stays passwordless: request a short-lived email
          code, verify it in the app, then continue into onboarding, tenant
          selection, or the active workspace.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Server-trusted access',
              body: 'Role and permission checks still run from business data, not browser claims.',
            },
            {
              icon: MailCheck,
              title: 'Passwordless entry',
              body: 'A 6-digit email code replaces the default password-first sign-in step.',
            },
            {
              icon: LogIn,
              title: 'Multi-tenant ready',
              body: 'Authenticated users still route into account completion or tenant choice when needed.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card
              key={title}
              className="rounded-[1.35rem] border-border/65 bg-background/65 p-4"
            >
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon />
              </div>
              <p className="mt-4 text-sm font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {body}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="ops-panel rounded-[1.8rem] border-border/65 p-6 md:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ops-kicker">Access</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {isVerifyStep
                ? 'Verify the emailed code'
                : 'Request a sign-in code'}
            </h2>
          </div>
          {session.isPending ? (
            <Loader2 className="animate-spin text-muted-foreground" />
          ) : null}
        </div>

        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) =>
            void (isVerifyStep
              ? handleVerifyCode(event)
              : handleRequestCode(event))
          }
        >
          {!isVerifyStep ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
          ) : (
            <div className="rounded-[1.2rem] border border-border/65 bg-background/70 p-4">
              <p className="text-sm font-semibold">Code sent to</p>
              <p className="mt-1 text-sm text-muted-foreground">{email}</p>
              <Button
                type="button"
                variant="ghost"
                className="mt-3 h-auto rounded-full px-0 text-sm"
                onClick={handleUseDifferentEmail}
              >
                Use a different email
              </Button>
            </div>
          )}

          {isVerifyStep ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="token">
                8-digit code
              </label>
              <Input
                id="token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="12345678"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                required
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
              {successMessage}
            </p>
          ) : null}

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Button
              type="submit"
              className="rounded-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              {isVerifyStep ? 'Verify code' : 'Send sign-in code'}
            </Button>
            {isVerifyStep ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={isSubmitting || !email}
                onClick={() => void submitOtpRequest()}
              >
                Send another code
              </Button>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>

          <div className="border-t border-border/65 pt-4 text-sm text-muted-foreground">
            <p>
              New workspace owner?{' '}
              <Link
                to="/sign-up"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                Create an account
              </Link>
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground/80">
              Password recovery stays available for accounts that still need to
              rotate an existing password.{' '}
              <Link
                to="/forgot-password"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                Open reset flow
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </section>
  )
}
