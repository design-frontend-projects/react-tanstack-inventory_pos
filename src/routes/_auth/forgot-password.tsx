import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Loader2, MailCheck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { sendForgotPasswordServerFn } from '#/features/auth/server-functions'
import { forgotPasswordSchema } from '#/features/auth/validation'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const parsedForm = forgotPasswordSchema.safeParse({
      email,
      origin: window.location.origin,
    })

    if (!parsedForm.success) {
      setError(parsedForm.error.issues[0]?.message ?? 'Enter a valid email address.')
      return
    }

    setIsSubmitting(true)

    try {
      await sendForgotPasswordServerFn({
        data: parsedForm.data,
      })
      setSuccessMessage('If the account exists, a reset email has been sent.')
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to send reset email.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="ops-shell rounded-[2rem] px-6 py-8 md:px-8 md:py-9">
        <p className="ops-kicker">Password recovery</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
          Send a reset link without exposing whether the account exists.
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
          Reset emails route back into the application so the new password can be set
          against the verified Supabase recovery session instead of a public token form.
        </p>
      </div>

      <Card className="ops-panel rounded-[1.8rem] border-border/65 p-6 md:p-7">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck />
          </div>
          <div>
            <p className="ops-kicker">Reset request</p>
            <h2 className="mt-1 text-2xl font-semibold">Email reset instructions</h2>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />

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
            Send reset email
          </Button>

          <p className="border-t border-border/65 pt-4 text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link
              to="/sign-in"
              className="font-medium text-foreground underline decoration-border underline-offset-4"
            >
              Return to sign in
            </Link>
          </p>
        </form>
      </Card>
    </section>
  )
}
