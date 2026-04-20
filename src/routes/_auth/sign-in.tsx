import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Loader2, LogIn, MailCheck, ShieldCheck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import {
  sendMagicLink,
  signInWithPassword,
} from '#/features/auth/browser-auth'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'

export const Route = createFileRoute('/_auth/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  const navigate = Route.useNavigate()
  const { isAuthenticated, isPending, memberships, needsProfileCompletion, activeTenantId } =
    useSessionBootstrap()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    if (needsProfileCompletion) {
      void navigate({ to: '/complete-account' })
      return
    }

    if (!memberships.length) {
      return
    }

    if (!activeTenantId && memberships.length > 1) {
      void navigate({ to: '/select-tenant' })
      return
    }

    void navigate({ to: '/dashboard' })
  }, [activeTenantId, isAuthenticated, memberships.length, navigate, needsProfileCompletion])

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    const { error: signInError } = await signInWithPassword(email, password)

    setIsSubmitting(false)

    if (signInError) {
      setError(signInError.message)
    }
  }

  async function handleMagicLink() {
    setError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    const { error: magicLinkError } = await sendMagicLink(
      email,
      window.location.origin
    )

    setIsSubmitting(false)

    if (magicLinkError) {
      setError(magicLinkError.message)
      return
    }

    setSuccessMessage('Magic link sent. Check your email to continue.')
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="ops-shell rounded-[2rem] px-6 py-8 md:px-8 md:py-9">
        <p className="ops-kicker">Authentication foundation</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
          Sign in with your tenant account and let the server resolve the rest.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
          Sessions are validated server-side, tenant access comes from local business
          tables, and new invited users are routed into profile completion before the
          workspace opens.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Server-trusted access',
              body: 'Role and permission checks run from business data, not browser claims.',
            },
            {
              icon: MailCheck,
              title: 'Invitation onboarding',
              body: 'Invited users complete profile details before the tenant becomes active.',
            },
            {
              icon: LogIn,
              title: 'Multi-tenant ready',
              body: 'Workspace selection stays separate from authentication identity.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="rounded-[1.35rem] border-border/65 bg-background/65 p-4">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon />
              </div>
              <p className="mt-4 text-sm font-semibold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="ops-panel rounded-[1.8rem] border-border/65 p-6 md:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ops-kicker">Access</p>
            <h2 className="mt-2 text-2xl font-semibold">Sign in or request a magic link</h2>
          </div>
          {isPending ? <Loader2 className="animate-spin text-muted-foreground" /> : null}
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handlePasswordSignIn}>
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

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

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
            <Button type="submit" className="rounded-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              Sign in
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={isSubmitting || !email}
              onClick={() => void handleMagicLink()}
            >
              Send magic link
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/65 pt-4 text-sm text-muted-foreground">
            <Link
              to="/forgot-password"
              className="font-medium text-foreground underline decoration-border underline-offset-4"
            >
              Forgot password?
            </Link>
            <p>
              New workspace owner?{' '}
              <Link
                to="/sign-up"
                className="font-medium text-foreground underline decoration-border underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </div>
        </form>
      </Card>
    </section>
  )
}
