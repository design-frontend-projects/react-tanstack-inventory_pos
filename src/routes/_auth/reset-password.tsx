import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { getAccessToken } from '#/features/auth/browser-auth'
import { resetPasswordServerFn } from '#/features/auth/server-functions'
import { resetPasswordSchema } from '#/features/auth/validation'

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = Route.useNavigate()
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setError('Open the reset link from your email before setting a new password.')
      return
    }

    const parsedForm = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    })

    if (!parsedForm.success) {
      setError(parsedForm.error.issues[0]?.message ?? 'Review the password fields.')
      return
    }

    setIsSubmitting(true)

    try {
      await resetPasswordServerFn({
        data: {
          accessToken,
          ...parsedForm.data,
        },
      })
      setSuccessMessage('Password updated. Redirecting to sign in...')
      window.setTimeout(() => {
        void navigate({ to: '/sign-in' })
      }, 800)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to reset the password.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="ops-shell rounded-[2rem] px-6 py-8 md:px-8 md:py-9">
        <p className="ops-kicker">Recovery session</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
          Set a new password against the verified reset session.
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
          The page depends on the recovery session established by Supabase when the
          email link is opened. No password reset is processed without that verified
          auth session.
        </p>
      </div>

      <Card className="ops-panel rounded-[1.8rem] border-border/65 p-6 md:p-7">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole />
          </div>
          <div>
            <p className="ops-kicker">New password</p>
            <h2 className="mt-1 text-2xl font-semibold">Reset password</h2>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            autoComplete="new-password"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
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
            Update password
          </Button>

          <p className="border-t border-border/65 pt-4 text-sm text-muted-foreground">
            Back to{' '}
            <Link
              to="/sign-in"
              className="font-medium text-foreground underline decoration-border underline-offset-4"
            >
              sign in
            </Link>
          </p>
        </form>
      </Card>
    </section>
  )
}
