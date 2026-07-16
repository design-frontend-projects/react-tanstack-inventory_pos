import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, UserRound } from 'lucide-react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { updateProfileServerFn } from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { profileUpdateSchema } from '#/features/auth/validation'
import { withAccessToken } from '#/features/auth/with-access-token'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const queryClient = useQueryClient()
  const session = useSessionBootstrap()
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    phone: '',
    avatarUrl: '',
  })
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!session.user) {
      return
    }

    setForm({
      firstName: session.user.firstName ?? '',
      lastName: session.user.lastName ?? '',
      phone: session.user.phone ?? '',
      avatarUrl: session.user.avatarUrl ?? '',
    })
  }, [session.user])

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      setSuccessMessage(null)

      const parsedForm = profileUpdateSchema.safeParse(form)
      if (!parsedForm.success) {
        throw new Error(parsedForm.error.issues[0]?.message ?? 'Review the profile form.')
      }

      return withAccessToken((accessToken) =>
        updateProfileServerFn({
          data: {
            accessToken,
            ...parsedForm.data,
          },
        })
      )
    },
    onSuccess: async () => {
      setSuccessMessage('Profile updated.')
      await queryClient.invalidateQueries({
        queryKey: ['auth', 'session-bootstrap'],
      })
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to update the profile.'
      )
    },
  })

  if (!session.user) {
    return (
      <WorkspaceEmptyState
        title="Profile unavailable"
        description="Sign in before updating profile details."
      />
    )
  }

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Self profile"
      title="Update the account details that remain user-managed."
      description="Name, phone, and avatar stay self-service. Email identity, tenant access, owner state, and RBAC assignments remain server-controlled."
      metrics={[
        {
          label: 'Email',
          value: session.user.email,
          hint: 'Read-only auth identity',
          tone: 'neutral',
        },
        {
          label: 'Profile state',
          value: session.user.profileCompleted ? 'Complete' : 'Pending',
          hint: 'Profile completion flag',
          tone: 'red',
        },
        {
          label: 'Tenant role',
          value: session.activeMembership?.roleLabel ?? 'No tenant',
          hint: session.activeMembership?.tenantName ?? 'No active workspace',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Editable fields"
        title="Profile details"
        description="Only permitted self-service fields are exposed on this page."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void updateProfileMutation.mutateAsync()
          }}
        >
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
            <Input value={session.user.email} disabled readOnly />
            <Input
              value={session.activeMembership?.roleLabel ?? 'No active role'}
              disabled
              readOnly
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

          <div className="flex justify-end">
            <Button
              type="submit"
              className="rounded-full"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? <Loader2 className="animate-spin" /> : <UserRound />}
              Save profile
            </Button>
          </div>
        </form>
      </WorkspacePanel>
    </WorkspacePage>
  )
}
