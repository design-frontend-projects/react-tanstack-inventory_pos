import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import type { ManageableRole } from '#/types/security'
import {
  createRoleServerFn,
  deleteRoleServerFn,
  getRoleManagementServerFn,
  updateRoleServerFn,
} from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { withAccessToken } from '#/features/auth/with-access-token'
import { hasPermission } from '#/features/auth/permissions'
import { AccessGuard } from '#/features/auth/access-guard'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'

export const Route = createFileRoute('/_app/settings/roles')({
  component: RoleManagementPage,
})

const ROLES_QUERY_KEY = ['settings', 'role-management'] as const

type FormState = {
  editingRoleId: string | null
  name: string
  description: string
  rank: string
  selected: Set<string>
}

const EMPTY_FORM: FormState = {
  editingRoleId: null,
  name: '',
  description: '',
  rank: '10',
  selected: new Set(),
}

function RoleManagementPage() {
  const queryClient = useQueryClient()
  const session = useSessionBootstrap()
  const tenantId = session.activeTenantId
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'role.manage')

  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [error, setError] = React.useState<string | null>(null)

  const roleQuery = useQuery({
    enabled: !!tenantId,
    queryKey: [...ROLES_QUERY_KEY, tenantId],
    queryFn: async () =>
      withAccessToken((accessToken) =>
        getRoleManagementServerFn({
          data: { accessToken, tenantId: tenantId! },
        })
      ),
  })

  // Only permissions the current admin holds can be granted to a new role.
  const grantablePermissions = React.useMemo(
    () =>
      (roleQuery.data?.permissions ?? []).filter((permission) =>
        permissions.includes(permission.code)
      ),
    [roleQuery.data?.permissions, permissions]
  )

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setError(null)
  }

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY })
  }

  const createMutation = useMutation({
    mutationFn: async () =>
      withAccessToken((accessToken) =>
        createRoleServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            name: form.name,
            description: form.description || null,
            rank: Number(form.rank),
            permissionCodes: [...form.selected],
          },
        })
      ),
    onSuccess: async () => {
      resetForm()
      await invalidate()
    },
    onError: (mutationError: unknown) =>
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to create role.'),
  })

  const updateMutation = useMutation({
    mutationFn: async () =>
      withAccessToken((accessToken) =>
        updateRoleServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
            roleId: form.editingRoleId!,
            name: form.name,
            description: form.description || null,
            rank: Number(form.rank),
            permissionCodes: [...form.selected],
          },
        })
      ),
    onSuccess: async () => {
      resetForm()
      await invalidate()
    },
    onError: (mutationError: unknown) =>
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to update role.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) =>
      withAccessToken((accessToken) =>
        deleteRoleServerFn({
          data: { accessToken, tenantId: tenantId!, roleId },
        })
      ),
    onSuccess: async () => {
      resetForm()
      await invalidate()
    },
    onError: (mutationError: unknown) =>
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to delete role.'),
  })

  const startEdit = (role: ManageableRole) => {
    setError(null)
    setForm({
      editingRoleId: role.id,
      name: role.name,
      description: role.description ?? '',
      rank: String(role.rank),
      selected: new Set(role.permissionCodes),
    })
  }

  const togglePermission = (code: string) => {
    setForm((current) => {
      const selected = new Set(current.selected)
      if (selected.has(code)) {
        selected.delete(code)
      } else {
        selected.add(code)
      }
      return { ...current, selected }
    })
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const canSubmit =
    canManage && form.name.trim().length > 0 && Number(form.rank) > 0 && !isSaving

  const submit = () => {
    if (!canSubmit) {
      return
    }
    if (form.editingRoleId) {
      void updateMutation.mutateAsync()
    } else {
      void createMutation.mutateAsync()
    }
  }

  if (!tenantId) {
    return (
      <WorkspaceEmptyState
        title="No active workspace"
        description="Select a tenant before managing roles."
      />
    )
  }

  const data = roleQuery.data
  const customRoleCount = data?.roles.filter((role) => !role.isSystem).length ?? 0

  return (
    <AccessGuard
      permissions={['role.view', 'role.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You do not have permission to manage roles."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Role management"
        title="Compose tenant roles from the permission catalog."
        description="System roles are read-only baselines. Create custom roles for this workspace by granting a subset of the permissions you hold; roles are enforced server-side for every action."
        metrics={[
          {
            label: 'Roles',
            value: String(data?.roles.length ?? 0),
            hint: 'System + custom',
            tone: 'neutral',
          },
          {
            label: 'Custom roles',
            value: String(customRoleCount),
            hint: 'Editable in this tenant',
            tone: 'teal',
          },
          {
            label: 'Your authority',
            value: String(data?.actorRank ?? 0),
            hint: 'Max rank you can grant below',
            tone: 'amber',
          },
        ]}
      >
        {canManage ? (
          <WorkspacePanel
            eyebrow={form.editingRoleId ? 'Edit role' : 'New role'}
            title={form.editingRoleId ? 'Update a custom role' : 'Create a custom role'}
            description="Name the role, set its rank (must be below your authority), and pick the permissions to grant."
          >
            <div className="grid gap-4">
              {error ? (
                <div className="rounded-[1rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="e.g. Shift Supervisor"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Rank</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.rank}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, rank: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="What is this role for?"
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Permissions ({form.selected.size} selected)
                </p>
                {grantablePermissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You do not hold any grantable permissions.
                  </p>
                ) : (
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {grantablePermissions.map((permission) => (
                      <label
                        key={permission.code}
                        className="flex cursor-pointer items-start gap-2 rounded-[0.9rem] border border-border/55 bg-background/60 p-2.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={form.selected.has(permission.code)}
                          onChange={() => togglePermission(permission.code)}
                        />
                        <span>
                          <span className="font-medium">{permission.code}</span>
                          <span className="block text-xs text-muted-foreground">
                            {permission.description ?? permission.name}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!canSubmit} onClick={submit}>
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : form.editingRoleId ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {form.editingRoleId ? 'Save changes' : 'Create role'}
                </Button>
                {form.editingRoleId ? (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    <X className="size-4" />
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          </WorkspacePanel>
        ) : null}

        <WorkspacePanel
          eyebrow="Roles"
          title="System & custom roles"
          description="System roles are seeded and read-only. Custom roles can be edited or deleted while no users are assigned."
        >
          {roleQuery.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {(data?.roles ?? []).map((role) => (
                <article
                  key={role.id}
                  className="rounded-[1.2rem] border border-border/65 bg-background/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">{role.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{role.code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant={role.isSystem ? 'secondary' : 'default'}>
                        {role.isSystem ? 'system' : 'custom'}
                      </Badge>
                      <Badge variant="outline">Rank {role.rank}</Badge>
                    </div>
                  </div>

                  {role.description ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {role.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{role.permissionCodes.length} permissions</span>
                    <span aria-hidden>·</span>
                    <span>{role.assignedUserCount} users</span>
                  </div>

                  {canManage && !role.isSystem ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => startEdit(role)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-destructive hover:text-destructive"
                        disabled={deleteMutation.isPending || role.assignedUserCount > 0}
                        onClick={() => void deleteMutation.mutateAsync(role.id)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}
