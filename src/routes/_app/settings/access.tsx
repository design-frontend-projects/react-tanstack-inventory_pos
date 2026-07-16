import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, ShieldCheck } from 'lucide-react'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import {
  getTenantUserEffectiveAccessServerFn,
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
      permissionCode: string
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

  const effectiveQuery = useQuery({
    enabled: !!tenantId && !!selectedTenantUserId,
    queryKey: [...ACCESS_QUERY_KEY, 'effective', tenantId, selectedTenantUserId],
    queryFn: async () =>
      withAccessToken((accessToken) =>
        getTenantUserEffectiveAccessServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            tenantUserId: selectedTenantUserId!,
          },
        })
      ),
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
            tone: 'red',
          },
          {
            label: 'Users with overrides',
            value: String(
              accessQuery.data?.users.filter((user) => user.permissionOverrides.length > 0).length ?? 0
            ),
            hint: 'Direct allow or deny rules',
            tone: 'accent',
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

        <WorkspacePanel
          eyebrow="Effective access"
          title="Resolved permissions for the selected user"
          description="The final permission set after merging every assigned role with direct overrides. 'Denied' rows are removed by an override; 'granted' rows are added directly on top of the role."
        >
          {!selectedTenantUserId ? (
            <WorkspaceEmptyState
              title="No user selected"
              description="Select a tenant user in the panel above to review their effective permissions."
            />
          ) : effectiveQuery.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : effectiveQuery.data ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{effectiveQuery.data.displayName}</p>
                {effectiveQuery.data.roleLabels.map((roleLabel) => (
                  <Badge key={roleLabel} variant="outline">
                    {roleLabel}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">
                  {effectiveQuery.data.effectivePermissions.filter((entry) => entry.effective).length}{' '}
                  effective
                </span>
              </div>

              <div className="grid gap-2">
                {effectiveQuery.data.effectivePermissions.map((entry) => (
                  <div
                    key={entry.code}
                    className={
                      entry.effective
                        ? 'flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/55 bg-background/60 p-3'
                        : 'flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-destructive/30 bg-destructive/5 p-3'
                    }
                  >
                    <div>
                      <p className="text-sm font-medium">{entry.code}</p>
                      <p className="text-xs text-muted-foreground">{entry.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          entry.source === 'denied'
                            ? 'destructive'
                            : entry.source === 'granted'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {entry.source}
                      </Badge>
                      <Badge variant={entry.effective ? 'outline' : 'secondary'}>
                        {entry.effective ? 'effective' : 'blocked'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}
