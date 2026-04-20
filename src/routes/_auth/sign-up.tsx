import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Loader2, MailCheck, ShieldCheck, Store } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { startTenantRegistrationServerFn } from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { ACTIVITY_OPTIONS, signUpSchema } from '#/features/auth/validation'

export const Route = createFileRoute('/_auth/sign-up')({
  component: SignUpPage,
})

type SignUpFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  activity: (typeof ACTIVITY_OPTIONS)[number]
}

function SignUpPage() {
  const navigate = Route.useNavigate()
  const session = useSessionBootstrap()
  const [form, setForm] = React.useState<SignUpFormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    activity: ACTIVITY_OPTIONS[0],
  })
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (session.isPending || !session.isAuthenticated) {
      return
    }

    if (session.needsAccountCompletion) {
      void navigate({ to: '/complete-account' })
      return
    }

    if (session.needsTenantSelection) {
      void navigate({ to: '/select-tenant' })
      return
    }

    if (session.activeTenantId) {
      void navigate({ to: '/dashboard' })
    }
  }, [
    navigate,
    session.activeTenantId,
    session.isAuthenticated,
    session.isPending,
    session.needsAccountCompletion,
    session.needsTenantSelection,
  ])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const parsedForm = signUpSchema.safeParse({
      ...form,
      origin: window.location.origin,
    })

    if (!parsedForm.success) {
      setError(parsedForm.error.issues[0]?.message ?? 'Review the registration form.')
      return
    }

    setIsSubmitting(true)

    try {
      await startTenantRegistrationServerFn({
        data: parsedForm.data,
      })

      setSuccessMessage('Check your email. The magic link will take you into account setup.')
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to start registration.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="ops-shell rounded-4xl px-6 py-8 md:px-8 md:py-9">
        <p className="ops-kicker">Tenant self-registration</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
          Create the first owner account, verify the email, then finish tenant setup.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
          Public sign-up only stages the request and sends the magic link. Tenant
          creation, owner membership, and `super_admin` assignment are deferred until
          the verified user completes account setup.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: MailCheck,
              title: 'Email-first verification',
              body: 'No workspace access is granted until the email owner completes the link flow.',
            },
            {
              icon: ShieldCheck,
              title: 'Owner-safe defaults',
              body: 'The staged request always resolves to an owner membership with canonical `super_admin` access.',
            },
            {
              icon: Store,
              title: 'Tenant setup later',
              body: 'Tenant name and defaults are captured only after the identity is verified.',
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
        <div>
          <p className="ops-kicker">Owner registration</p>
          <h2 className="mt-2 text-2xl font-semibold">Start the magic-link flow</h2>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
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

          <Input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="owner@company.com"
            autoComplete="email"
          />

          <Input
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="+20 100 000 0000"
            autoComplete="tel"
          />

          <select
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            value={form.activity}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                activity: event.target.value as (typeof ACTIVITY_OPTIONS)[number],
              }))
            }
          >
            {ACTIVITY_OPTIONS.map((activity) => (
              <option key={activity} value={activity}>
                {activity}
              </option>
            ))}
          </select>

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

          <Button type="submit" className="rounded-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Send magic link
          </Button>

          <p className="border-t border-border/65 pt-4 text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to="/sign-in"
              className="font-medium text-foreground underline decoration-border underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </form>
      </Card>
    </section>
  )
}
