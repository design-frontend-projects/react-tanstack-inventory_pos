import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Sparkles, UserRoundCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { z } from 'zod/v4'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { getAccessToken, getSupabaseUser } from '#/features/auth/browser-auth'
import { completeInvitedProfileServerFn } from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'

export const Route = createFileRoute('/_auth/complete-profile')({
  component: CompleteProfilePage,
})

const completeProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(60, 'First name must be 60 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(60, 'Last name must be 60 characters or fewer.'),
  phone: z
    .string()
    .trim()
    .max(32, 'Phone number must be 32 characters or fewer.')
    .refine(
      (value) => value.length === 0 || /^[+\d().\-\s/]+$/.test(value),
      'Use digits and phone punctuation only.'
    ),
  avatarUrl: z
    .string()
    .trim()
    .max(2048, 'Avatar URL is too long.')
    .refine(
      (value) => value.length === 0 || URL.canParse(value),
      'Enter a valid URL.'
    ),
})

type CompleteProfileFormValues = z.input<typeof completeProfileSchema>
type ZodResolverSchema = Parameters<typeof zodResolver>[0]
type CompleteProfileResolver = Resolver<
  z.input<typeof completeProfileSchema>,
  undefined,
  z.output<typeof completeProfileSchema>
>

function getDefaultValues(displayName?: string | null): CompleteProfileFormValues {
  const trimmedDisplayName = displayName?.trim() ?? ''

  if (!trimmedDisplayName) {
    return {
      firstName: '',
      lastName: '',
      phone: '',
      avatarUrl: '',
    }
  }

  const [firstName = '', ...rest] = trimmedDisplayName.split(/\s+/)

  return {
    firstName,
    lastName: rest.join(' '),
    phone: '',
    avatarUrl: '',
  }
}

function FieldMessage({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-sm text-destructive">{message}</p>
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-5 text-muted-foreground">{children}</p>
}

function CompleteProfilePage() {
  const navigate = Route.useNavigate()
  const session = useSessionBootstrap()
  const defaultValues = React.useMemo(
    () => getDefaultValues(session.user?.displayName),
    [session.user?.displayName]
  )
  const resolver = React.useMemo(
    () =>
      zodResolver(
        // The installed resolver types expect a different Zod v4 internal version.
        completeProfileSchema as unknown as ZodResolverSchema
      ) as unknown as CompleteProfileResolver,
    []
  )
  const form = useForm<
    z.input<typeof completeProfileSchema>,
    undefined,
    z.output<typeof completeProfileSchema>
  >({
    resolver,
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })
  const {
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = form

  React.useEffect(() => {
    if (session.isPending) {
      return
    }

    if (!session.isAuthenticated) {
      void navigate({ to: '/sign-in' })
      return
    }

    if (session.user?.onboardingCompleted && session.activeTenantId) {
      void navigate({ to: '/dashboard' })
    }
  }, [
    navigate,
    session.activeTenantId,
    session.isAuthenticated,
    session.isPending,
    session.user?.onboardingCompleted,
  ])

  React.useEffect(() => {
    if (isDirty) {
      return
    }

    reset(defaultValues)
  }, [defaultValues, isDirty, reset])

  const onSubmit = handleSubmit(async (values) => {
    const [accessToken, authUser] = await Promise.all([
      getAccessToken(),
      getSupabaseUser(),
    ])

    if (!accessToken || !authUser?.email) {
      setError('root', {
        message: 'A valid authenticated session is required.',
      })
      return
    }

    try {
      const result = await completeInvitedProfileServerFn({
        data: {
          accessToken,
          email: authUser.email,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || null,
          avatarUrl: values.avatarUrl || null,
          password: null,
          confirmPassword: null,
        },
      })

      await session.setActiveTenantId(result.tenantId)
      void navigate({ to: '/dashboard' })
    } catch (submissionError) {
      setError('root', {
        message:
          submissionError instanceof Error
            ? submissionError.message
            : 'Unable to complete your profile.',
      })
    }
  })

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="ops-shell rounded-4xl px-6 py-8 md:px-8 md:py-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="ops-kicker">First login</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
              Complete your profile before the tenant workspace opens.
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
              Invitation metadata is already linked to your account. Add the last
              identity details once and the workspace will move from invited to active.
            </p>
          </div>

          <div className="min-w-60 rounded-[1.4rem] border border-border/65 bg-background/70 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              Ready to activate
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              We only need your name and any optional contact details you want
              attached to this tenant profile.
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
              <p className="text-sm font-semibold">Profile completion</p>
              <p className="text-sm text-muted-foreground">
                Signed in as {session.user?.email ?? 'your account'}
              </p>
            </div>
          </div>

          <form className="mt-6 grid gap-5" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="first-name">
                  First name
                </label>
                <Input
                  id="first-name"
                  autoComplete="given-name"
                  placeholder="Amina"
                  aria-invalid={errors.firstName ? true : undefined}
                  {...register('firstName')}
                />
                <FieldMessage message={errors.firstName?.message} />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="last-name">
                  Last name
                </label>
                <Input
                  id="last-name"
                  autoComplete="family-name"
                  placeholder="Hassan"
                  aria-invalid={errors.lastName ? true : undefined}
                  {...register('lastName')}
                />
                <FieldMessage message={errors.lastName?.message} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="phone">
                  Phone
                </label>
                <Input
                  id="phone"
                  autoComplete="tel"
                  placeholder="+20 100 000 0000"
                  aria-invalid={errors.phone ? true : undefined}
                  {...register('phone')}
                />
                <FieldHint>Optional. Used for tenant-side contact and support.</FieldHint>
                <FieldMessage message={errors.phone?.message} />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="avatar-url">
                  Avatar URL
                </label>
                <Input
                  id="avatar-url"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  aria-invalid={errors.avatarUrl ? true : undefined}
                  {...register('avatarUrl')}
                />
                <FieldHint>
                  Optional. Leave blank if you do not want to attach an image yet.
                </FieldHint>
                <FieldMessage message={errors.avatarUrl?.message} />
              </div>
            </div>

            {errors.root?.message ? (
              <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.root.message}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border/65 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted-foreground">
                This only updates your invited tenant profile and opens the workspace.
              </p>

              <Button
                type="submit"
                className="rounded-full sm:min-w-44"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Finish onboarding
              </Button>
            </div>
          </form>
        </Card>

        <Card className="rounded-[1.8rem] border-border/65 bg-card/80 p-6 md:p-7">
          <p className="ops-kicker">What happens next</p>
          <div className="mt-4 grid gap-4">
            {[
              {
                title: 'Profile becomes active',
                body: 'The invited tenant relationship is promoted so the workspace can be opened.',
              },
              {
                title: 'Tenant context is selected',
                body: 'Your active tenant is set immediately after the server accepts the profile payload.',
              },
              {
                title: 'Dashboard opens directly',
                body: 'You land in the authenticated workspace without repeating the onboarding step.',
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className="rounded-[1.2rem] border border-border/65 bg-background/70 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm font-semibold">{item.title}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  )
}
