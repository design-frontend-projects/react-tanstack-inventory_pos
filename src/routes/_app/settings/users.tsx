import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, RefreshCcw, ShieldPlus } from 'lucide-react'
import { AccessGuard } from '#/features/auth/access-guard'
import { canResendInvitation } from '#/features/auth/invitations'
import { hasPermission } from '#/features/auth/permissions'
import {
  changeTenantUserPrimaryRoleServerFn,
  inviteTenantUserServerFn,
  listTenantAssignableRolesServerFn,
  listTenantUsersServerFn,
  revokeTenantInvitationServerFn,
  resendTenantInvitationServerFn,
  updateTenantUserStatusServerFn,
} from '#/features/auth/server-functions'
import { withAccessToken } from '#/features/auth/with-access-token'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type {
  InvitationStatusCode,
  TenantUserFilters,
  TenantUserListItem,
  TenantUserStatusCode,
} from '#/types/auth'
import type { TENANT_ASSIGNABLE_ROLE_CODES } from '#/features/auth/rbac-catalog'

export const Route = createFileRoute('/_app/settings/users')({
  component: UsersAccessPage,
})

const USER_QUERY_KEY = ['settings', 'tenant-users'] as const
const ROLE_QUERY_KEY = ['settings', 'tenant-roles'] as const

const USER_STATUS_OPTIONS: Array<TenantUserStatusCode | 'all'> = [
  'all',
  'invited',
  'active',
  'suspended',
  'disabled',
  'rejected',
]

const INVITATION_STATUS_OPTIONS: Array<InvitationStatusCode | 'all'> = [
  'all',
  'pending',
  'accepted',
  'expired',
  'revoked',
  'failed',
]

function statusTone(status: TenantUserStatusCode | InvitationStatusCode | null) {
  switch (status) {
    case 'active':
    case 'accepted':
      return 'default'
    case 'pending':
    case 'invited':
      return 'secondary'
    case 'suspended':
    case 'disabled':
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function UsersAccessPage() {
  const queryClient = useQueryClient()
  const session = useSessionBootstrap()
  const tenantId = session.activeTenantId
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const [search, setSearch] = React.useState('')
  const [roleCode, setRoleCode] = React.useState<TenantUserFilters['roleCode']>('all')
  const [status, setStatus] = React.useState<TenantUserFilters['status']>('all')
  const [invitationStatus, setInvitationStatus] =
    React.useState<TenantUserFilters['invitationStatus']>('all')
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteError, setInviteError] = React.useState<string | null>(null)
  const [inviteForm, setInviteForm] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    jobTitle: '',
    roleCode: 'res:user',
  })
  const canAssignRoles = hasPermission(permissions, 'user.change_role')

  const rolesQuery = useQuery({
    enabled: !!tenantId,
    queryKey: [...ROLE_QUERY_KEY, tenantId],
    queryFn: async () =>
      withAccessToken((accessToken) =>
        listTenantAssignableRolesServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
          },
        })
      ),
  })

  const usersQuery = useQuery({
    enabled: !!tenantId,
    queryKey: [...USER_QUERY_KEY, tenantId, search, roleCode, status, invitationStatus],
    queryFn: async () =>
      withAccessToken((accessToken) =>
        listTenantUsersServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            filters: {
              search: search || undefined,
              roleCode,
              status,
              invitationStatus,
            },
          },
        })
      ),
  })

  const inviteMutation = useMutation({
    mutationFn: async () => {
      setInviteError(null)

      return withAccessToken((accessToken) =>
        inviteTenantUserServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            email: inviteForm.email,
            firstName: inviteForm.firstName,
            lastName: inviteForm.lastName,
            phone: inviteForm.phone || null,
            jobTitle: inviteForm.jobTitle || null,
            roleCode: inviteForm.roleCode as (typeof TENANT_ASSIGNABLE_ROLE_CODES)[number],
            origin: window.location.origin,
          },
        })
      )
    },
    onSuccess: async () => {
      setInviteOpen(false)
      setInviteForm({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        jobTitle: '',
        roleCode: 'res:user',
      })
      await queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEY,
      })
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : 'Unable to invite user.')
    },
  })

  const resendMutation = useMutation({
    mutationFn: async (user: TenantUserListItem) =>
      withAccessToken((accessToken) =>
        resendTenantInvitationServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            invitationId: user.invitationId!,
            origin: window.location.origin,
          },
        })
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEY,
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (user: TenantUserListItem) =>
      withAccessToken((accessToken) =>
        revokeTenantInvitationServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            invitationId: user.invitationId!,
          },
        })
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEY,
      })
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (payload: {
      tenantUserId: string
      status: 'active' | 'suspended' | 'disabled'
    }) =>
      withAccessToken((accessToken) =>
        updateTenantUserStatusServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            tenantUserId: payload.tenantUserId,
            status: payload.status,
          },
        })
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEY,
      })
    },
  })

  const roleMutation = useMutation({
    mutationFn: async (payload: {
      tenantUserId: string
      roleCode: string
    }) =>
      withAccessToken((accessToken) =>
        changeTenantUserPrimaryRoleServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            tenantUserId: payload.tenantUserId,
            roleCode: payload.roleCode as (typeof TENANT_ASSIGNABLE_ROLE_CODES)[number],
          },
        })
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEY,
      })
    },
  })

  const users = usersQuery.data ?? []
  const metrics = [
    {
      label: 'Active members',
      value: String(users.filter((user) => user.status === 'active').length),
      hint: 'Tenant users with current access',
      tone: 'red' as const,
    },
    {
      label: 'Pending invites',
      value: String(users.filter((user) => user.invitationStatus === 'pending').length),
      hint: 'Awaiting acceptance',
      tone: 'neutral' as const,
    },
    {
      label: 'Suspended or disabled',
      value: String(
        users.filter(
          (user) => user.status === 'suspended' || user.status === 'disabled'
        ).length
      ),
      hint: 'Blocked from tenant features',
      tone: 'accent' as const,
    },
  ]

  if (!tenantId) {
    return (
      <WorkspaceEmptyState
        title="No active workspace"
        description="Select a tenant before managing users and access."
      />
    )
  }

  return (
    <AccessGuard
      permissions={['user.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You do not have permission to manage tenant users."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Tenant access"
        title="Users and access now run from the real tenant membership model."
        description="Invitations, primary roles, activation state, and resend flows all run through server-validated tenant access and the shared RBAC helpers."
        metrics={metrics}
        actions={
          <AccessGuard
            permissions={['user.invite']}
            userRoles={roles}
            userPermissions={permissions}
          >
            <Button
              type="button"
              className="rounded-full"
              onClick={() => setInviteOpen(true)}
            >
              <ShieldPlus />
              Invite user
            </Button>
          </AccessGuard>
        }
      >
        <WorkspacePanel
          eyebrow="Filters"
          title="Narrow the user list without leaving the page"
          description="Filters apply server-side so the list reflects the current tenant access rules."
        >
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
            />
            <select
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
              value={roleCode}
              onChange={(event) => setRoleCode(event.target.value as TenantUserFilters['roleCode'])}
            >
              <option value="all">All roles</option>
              {(rolesQuery.data ?? []).map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as TenantUserFilters['status'])}
            >
              {USER_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption === 'all' ? 'All statuses' : statusOption}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
              value={invitationStatus}
              onChange={(event) =>
                setInvitationStatus(
                  event.target.value as TenantUserFilters['invitationStatus']
                )
              }
            >
              {INVITATION_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption === 'all'
                    ? 'All invitation states'
                    : statusOption}
                </option>
              ))}
            </select>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Directory"
          title="Tenant users and invitation state"
          description="Role changes, invite resend actions, and activation state are all enforced server-side."
        >
          {usersQuery.isPending ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <WorkspaceEmptyState
              title="No users match the current filters"
              description="Adjust the filters or invite a new user into this tenant."
            />
          ) : (
            <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-background/70">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Invitation</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.tenantUserId} className="border-t border-border/65">
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold">{user.displayName}</p>
                        <p className="mt-1 text-muted-foreground">{user.email}</p>
                        {user.isOwner ? (
                          <Badge variant="outline" className="mt-2">
                            Owner
                          </Badge>
                        ) : null}
                        {user.jobTitle ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {user.jobTitle}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {canAssignRoles ? (
                          <select
                            className="h-10 min-w-40 rounded-xl border border-input bg-background px-3 text-sm"
                            value={user.roleCode ?? ''}
                            onChange={(event) =>
                              void roleMutation.mutateAsync({
                                tenantUserId: user.tenantUserId,
                                roleCode: event.target.value,
                              })
                            }
                          >
                            {(rolesQuery.data ?? []).map((role) => (
                              <option key={role.code} value={role.code}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex min-h-10 items-center">
                            <span className="text-sm font-medium">
                              {user.roleLabel ?? 'Unassigned'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant={statusTone(user.status)}>{user.status}</Badge>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {user.invitationStatus ? (
                          <div className="flex flex-col gap-2">
                            <Badge variant={statusTone(user.invitationStatus)}>
                              {user.invitationStatus}
                            </Badge>
                            {user.invitationSentAt ? (
                              <span className="text-xs text-muted-foreground">
                                Sent {new Date(user.invitationSentAt).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No active invitation
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <AccessGuard
                            permissions={['user.invite']}
                            userRoles={roles}
                            userPermissions={permissions}
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              disabled={
                                !user.invitationId ||
                                !canResendInvitation(user.invitationStatus) ||
                                resendMutation.isPending
                              }
                              onClick={() => void resendMutation.mutateAsync(user)}
                            >
                              <RefreshCcw />
                              Resend
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              disabled={
                                !user.invitationId ||
                                user.invitationStatus === 'accepted' ||
                                user.invitationStatus === 'revoked' ||
                                revokeMutation.isPending
                              }
                              onClick={() => void revokeMutation.mutateAsync(user)}
                            >
                              Revoke
                            </Button>
                          </AccessGuard>
                          <AccessGuard
                            permissions={['user.deactivate', 'user.update']}
                            userRoles={roles}
                            userPermissions={permissions}
                          >
                            {user.status === 'active' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={statusMutation.isPending}
                                onClick={() =>
                                  void statusMutation.mutateAsync({
                                    tenantUserId: user.tenantUserId,
                                    status: 'suspended',
                                  })
                                }
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={statusMutation.isPending}
                                onClick={() =>
                                  void statusMutation.mutateAsync({
                                    tenantUserId: user.tenantUserId,
                                    status: 'active',
                                  })
                                }
                              >
                                Reactivate
                              </Button>
                            )}
                          </AccessGuard>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WorkspacePanel>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="max-w-xl rounded-[1.8rem] p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Invite tenant user</DialogTitle>
              <DialogDescription>
                Invitations are created on the server, matched against existing auth
                users when possible, and stored in the local invitation table.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 px-6 pb-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={inviteForm.firstName}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  placeholder="First name"
                />
                <Input
                  value={inviteForm.lastName}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  placeholder="Last name"
                />
              </div>

              <Input
                type="email"
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="user@company.com"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={inviteForm.phone}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Phone"
                />
                <Input
                  value={inviteForm.jobTitle}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      jobTitle: event.target.value,
                    }))
                  }
                  placeholder="Job title"
                />
              </div>

              <select
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                value={inviteForm.roleCode}
                onChange={(event) =>
                  setInviteForm((current) => ({
                    ...current,
                    roleCode: event.target.value,
                  }))
                }
              >
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>

              {inviteError ? (
                <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {inviteError}
                </p>
              ) : null}
            </div>

            <DialogFooter showCloseButton>
              <Button
                type="button"
                className="rounded-full"
                disabled={inviteMutation.isPending}
                onClick={() => void inviteMutation.mutateAsync()}
              >
                {inviteMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Send invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </WorkspacePage>
    </AccessGuard>
  )
}
