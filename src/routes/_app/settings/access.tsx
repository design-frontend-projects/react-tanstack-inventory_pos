import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, ShieldCheck } from 'lucide-react'
import { AccessGuard } from '#/features/auth/access-guard'
import type { PermissionCode } from '#/features/auth/rbac-catalog'
import { hasPermission } from '#/features/auth/permissions'
import {
  listRolesPermissionsServerFn,
  setUserPermissionOverrideServerFn,
} from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { withAccessToken } from '#/features/auth/with-access-token'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_app/settings/access')({
  component: AccessManagementPage,
})

const ACCESS_QUERY_KEY = ['settings', 'access-control'] as const

function AccessManagementPage() {
  const queryClient = useQueryClient()
  const session = useSessionBootstrap()
  const tenantId = session.activeTenantId
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canAssignPermissions = hasPermission(permissions, 'user.assign_permission')
  const [selectedTenantUserId, setSelectedTenantUserId] = React.useState<string | null>(null)

  const accessQuery = useQuery({
    enabled: !!tenantId,
    queryKey: [...ACCESS_QUERY_KEY, tenantId],
    queryFn: async () =>
      withAccessToken((accessToken) =>
        listRolesPermissionsServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
          },
        })
      ),
  })

  React.useEffect(() => {
    if (selectedTenantUserId || !accessQuery.data?.users.length) {
      return
    }

    setSelectedTenantUserId(accessQuery.data.users[0]?.tenantUserId ?? null)
  }, [accessQuery.data?.users, selectedTenantUserId])

  const overrideMutation = useMutation({
    mutationFn: async (payload: {
      tenantUserId: string
      permissionCode: PermissionCode
      isAllowed: boolean | null
    }) =>
      withAccessToken((accessToken) =>
        setUserPermissionOverrideServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            ...payload,
          },
        })
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ACCESS_QUERY_KEY,
      })
    },
  })

  if (!tenantId) {
    return (
      <WorkspaceEmptyState
        title="No active workspace"
        description="Select a tenant before reviewing access controls."
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
          description="You do not have permission to review roles and permissions."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Access control"
        title="Canonical roles, mapped permissions, and direct overrides live in one place."
        description="Role permissions are seeded system-wide. Per-user overrides are applied on top of the primary role and enforced server-side for every tenant-scoped action."
        metrics={[
          {
            label: 'Roles',
            value: String(accessQuery.data?.roles.length ?? 0),
            hint: 'Canonical role catalog',
            tone: 'neutral',
          },
          {
            label: 'Permissions',
            value: String(accessQuery.data?.permissions.length ?? 0),
            hint: 'Granular action keys',
            tone: 'teal',
          },
          {
            label: 'Users with overrides',
            value: String(
              accessQuery.data?.users.filter((user) => user.permissionOverrides.length > 0).length ?? 0
            ),
            hint: 'Direct allow or deny rules',
            tone: 'amber',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Roles"
          title="Role to permission mapping"
          description="These role permissions are the baseline. Direct user overrides only add or remove individual permissions on top."
        >
          {accessQuery.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(accessQuery.data?.roles ?? []).map((role) => (
                <article
                  key={role.roleId}
                  className="rounded-[1.2rem] border border-border/65 bg-background/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{role.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{role.code}</p>
                    </div>
                    <Badge variant="outline">Rank {role.rank}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {role.description ?? 'No description provided.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {role.permissions.map((permissionCode) => (
                      <Badge key={permissionCode} variant="secondary">
                        {permissionCode}
                      </Badge>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Overrides"
          title="Direct user permission overrides"
          description="Allow, deny, or clear specific permissions for a tenant user. Server-side rank checks prevent self-escalation and peer-level changes."
        >
          {accessQuery.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : !accessQuery.data?.users.length ? (
            <WorkspaceEmptyState
              title="No tenant users"
              description="Invite or activate users before assigning direct permission overrides."
            />
          ) : (
            <div className="grid gap-4">
              <select
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                value={selectedTenantUserId ?? ''}
                onChange={(event) => setSelectedTenantUserId(event.target.value)}
              >
                {accessQuery.data.users.map((user) => (
                  <option key={user.tenantUserId} value={user.tenantUserId}>
                    {user.displayName} · {user.roleLabel ?? 'Unassigned'}
                  </option>
                ))}
              </select>

              {(() => {
                const selectedUser =
                  accessQuery.data.users.find(
                    (user) => user.tenantUserId === selectedTenantUserId
                  ) ?? null

                if (!selectedUser) {
                  return null
                }

                const overrideByPermissionCode = new Map(
                  selectedUser.permissionOverrides.map((override) => [
                    override.permissionCode,
                    override.isAllowed,
                  ])
                )

                return (
                  <div className="grid gap-3">
                    <div className="rounded-[1.2rem] border border-border/65 bg-background/70 p-4">
                      <p className="text-sm font-semibold">{selectedUser.displayName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedUser.email}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{selectedUser.roleLabel ?? 'Unassigned'}</Badge>
                        {selectedUser.isOwner ? <Badge>Owner</Badge> : null}
                      </div>
                    </div>

                    {accessQuery.data.permissions.map((permission) => {
                      const overrideState = overrideByPermissionCode.get(permission.code)

                      return (
                        <div
                          key={permission.code}
                          className="grid gap-3 rounded-[1.2rem] border border-border/65 bg-background/70 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="size-4 text-muted-foreground" />
                              <p className="text-sm font-semibold">{permission.code}</p>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {permission.description ?? permission.name}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant={overrideState === true ? 'default' : 'outline'}
                              className="rounded-full"
                              disabled={!canAssignPermissions || overrideMutation.isPending}
                              onClick={() =>
                                void overrideMutation.mutateAsync({
                                  tenantUserId: selectedUser.tenantUserId,
                                  permissionCode: permission.code,
                                  isAllowed: true,
                                })
                              }
                            >
                              Allow
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={overrideState === false ? 'destructive' : 'outline'}
                              className="rounded-full"
                              disabled={!canAssignPermissions || overrideMutation.isPending}
                              onClick={() =>
                                void overrideMutation.mutateAsync({
                                  tenantUserId: selectedUser.tenantUserId,
                                  permissionCode: permission.code,
                                  isAllowed: false,
                                })
                              }
                            >
                              Deny
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-full"
                              disabled={!canAssignPermissions || overrideMutation.isPending}
                              onClick={() =>
                                void overrideMutation.mutateAsync({
                                  tenantUserId: selectedUser.tenantUserId,
                                  permissionCode: permission.code,
                                  isAllowed: null,
                                })
                              }
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}
