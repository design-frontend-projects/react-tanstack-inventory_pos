import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, ShieldCheck, SquareStack } from 'lucide-react'
import type {
  SecurityModuleNode,
  SecurityPermissionKind,
} from '#/types/security'
import { getSecurityOverviewServerFn } from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { withAccessToken } from '#/features/auth/with-access-token'
import { AccessGuard } from '#/features/auth/access-guard'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/_app/settings/security')({
  component: SecurityControlCenterPage,
})

const SECURITY_QUERY_KEY = ['settings', 'security-overview'] as const

const SECURITY_PERMISSIONS = [
  'tenant.manage_settings',
  'res.settings.manage',
  'user.view',
]

const KIND_TONE: Record<
  SecurityPermissionKind,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  screen: 'default',
  menu: 'secondary',
  action: 'secondary',
  api: 'outline',
  data: 'outline',
  admin: 'destructive',
}

function formatTimestamp(iso: string) {
  // Stable, SSR-safe formatting (avoids locale hydration mismatch).
  return iso.slice(0, 16).replace('T', ' ')
}

function ModuleCard({ module }: { module: SecurityModuleNode }) {
  return (
    <article className="rounded-[1.2rem] border border-border/65 bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{module.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{module.code}</p>
        </div>
        <Badge variant={module.isActive ? 'outline' : 'secondary'}>
          {module.screens.length} screens
        </Badge>
      </div>
      {module.description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {module.description}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        {module.screens.length === 0 ? (
          <p className="text-xs text-muted-foreground">No screens registered.</p>
        ) : (
          module.screens.map((screen) => (
            <div
              key={screen.id}
              className="rounded-[1rem] border border-border/55 bg-background/60 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SquareStack className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{screen.name}</p>
                  {!screen.isActive ? (
                    <Badge variant="secondary">inactive</Badge>
                  ) : null}
                </div>
                {screen.path ? (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {screen.path}
                  </code>
                ) : null}
              </div>

              {screen.defaultPermissionCode ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Access: <span className="font-medium">{screen.defaultPermissionCode}</span>
                </p>
              ) : null}

              {screen.actions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {screen.actions.map((action) => (
                    <Badge key={action.id} variant="outline" className="font-normal">
                      {action.actionKey}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </article>
  )
}

function SecurityControlCenterPage() {
  const session = useSessionBootstrap()
  const tenantId = session.activeTenantId
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []

  const overviewQuery = useQuery({
    enabled: !!tenantId,
    queryKey: [...SECURITY_QUERY_KEY, tenantId],
    queryFn: async () =>
      withAccessToken((accessToken) =>
        getSecurityOverviewServerFn({
          data: {
            accessToken,
            tenantId: tenantId!,
          },
        })
      ),
  })

  const permissionsByKind = React.useMemo(() => {
    const groups = new Map<SecurityPermissionKind, number>()
    for (const permission of overviewQuery.data?.permissions ?? []) {
      groups.set(permission.kind, (groups.get(permission.kind) ?? 0) + 1)
    }
    return groups
  }, [overviewQuery.data?.permissions])

  if (!tenantId) {
    return (
      <WorkspaceEmptyState
        title="No active workspace"
        description="Select a tenant before opening the security control center."
      />
    )
  }

  const counts = overviewQuery.data?.counts

  return (
    <AccessGuard
      permissions={SECURITY_PERMISSIONS}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You do not have permission to view the security control center."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Security control center"
        title="The database-driven RBAC registry — modules, screens, actions, and permissions in one view."
        description="Modules and screens define the navigable surface; each maps to a default access permission and a set of action-level permissions. Everything is stored in the database and enforced server-side."
        metrics={[
          {
            label: 'Modules',
            value: String(counts?.modules ?? 0),
            hint: 'Top-level app areas',
            tone: 'neutral',
          },
          {
            label: 'Screens',
            value: String(counts?.screens ?? 0),
            hint: 'Registered pages',
            tone: 'teal',
          },
          {
            label: 'Permissions',
            value: String(counts?.permissions ?? 0),
            hint: 'Granular access keys',
            tone: 'amber',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Registry"
          title="Modules, screens & actions"
          description="The dynamic navigation and authorization surface, ordered as it appears to users. Action badges are the button-level permissions gated per screen."
        >
          {overviewQuery.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : overviewQuery.isError ? (
            <WorkspaceEmptyState
              title="Unable to load registry"
              description="The security overview could not be loaded. Refresh to try again."
            />
          ) : !overviewQuery.data.modules.length ? (
            <WorkspaceEmptyState
              title="No modules registered"
              description="Run the database seed to bootstrap the module and screen registry."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {overviewQuery.data.modules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Permissions"
          title="Permission catalog"
          description="Every permission is typed by kind and linked to a module, screen, or action. These codes are the single source of truth for server-side authorization."
        >
          {overviewQuery.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {[...permissionsByKind.entries()].map(([kind, count]) => (
                  <Badge key={kind} variant={KIND_TONE[kind]}>
                    {kind}: {count}
                  </Badge>
                ))}
              </div>

              <div className="grid gap-2">
                {(overviewQuery.data?.permissions ?? []).map((permission) => (
                  <div
                    key={permission.code}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/55 bg-background/60 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{permission.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {permission.description ?? permission.name}
                        </p>
                      </div>
                    </div>
                    <Badge variant={KIND_TONE[permission.kind]}>{permission.kind}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Activity"
          title="Recent security activity"
          description="The most recent entries from the append-only audit ledger for this workspace."
        >
          {overviewQuery.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : !overviewQuery.data?.recentAudit.length ? (
            <WorkspaceEmptyState
              title="No recorded activity"
              description="Security-sensitive actions in this workspace will appear here."
            />
          ) : (
            <div className="grid gap-2">
              {overviewQuery.data.recentAudit.map((entry) => (
                <WorkspaceTimelineItem
                  key={entry.id}
                  leading={formatTimestamp(entry.createdAt)}
                  title={entry.actionKey}
                  description={`${entry.entityType}${entry.actorEmail ? ` · ${entry.actorEmail}` : ''}`}
                />
              ))}
            </div>
          )}
        </WorkspacePanel>
      </WorkspacePage>
    </AccessGuard>
  )
}
