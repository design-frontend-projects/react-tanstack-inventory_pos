import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2 } from 'lucide-react'
import type { ManageableModule, ManageableScreen } from '#/types/security'
import {
  getModuleManagementServerFn,
  reorderScreensServerFn,
  setModuleStateServerFn,
  setScreenVisibilityServerFn,
} from '#/features/auth/server-functions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { withAccessToken } from '#/features/auth/with-access-token'
import { hasPermission } from '#/features/auth/permissions'
import { resolveNavIcon } from '#/lib/navigation/icon-map'
import { AccessGuard } from '#/features/auth/access-guard'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/_app/settings/modules')({
  component: ModuleManagementPage,
})

const MODULES_QUERY_KEY = ['settings', 'module-management'] as const

function ModuleManagementPage() {
  const queryClient = useQueryClient()
  const session = useSessionBootstrap()
  const tenantId = session.activeTenantId
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'module.manage')

  const moduleQuery = useQuery({
    enabled: !!tenantId,
    queryKey: [...MODULES_QUERY_KEY, tenantId],
    queryFn: async () =>
      withAccessToken((accessToken) =>
        getModuleManagementServerFn({
          data: { accessToken, tenantId: tenantId! },
        })
      ),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: MODULES_QUERY_KEY })
    // navigation tree changes as screens/modules are toggled or reordered
    await queryClient.invalidateQueries({ queryKey: ['layout', 'navigation-tree'] })
  }

  const toggleModuleMutation = useMutation({
    mutationFn: async (payload: { moduleId: string; isEnabled: boolean }) =>
      withAccessToken((accessToken) =>
        setModuleStateServerFn({
          data: { accessToken, tenantId: tenantId!, ...payload },
        })
      ),
    onSuccess: invalidate,
  })

  const toggleScreenMutation = useMutation({
    mutationFn: async (payload: { screenId: string; showInMenu: boolean }) =>
      withAccessToken((accessToken) =>
        setScreenVisibilityServerFn({
          data: { accessToken, tenantId: tenantId!, ...payload },
        })
      ),
    onSuccess: invalidate,
  })

  const reorderMutation = useMutation({
    mutationFn: async (payload: {
      moduleId: string
      orderedScreenIds: Array<string>
    }) =>
      withAccessToken((accessToken) =>
        reorderScreensServerFn({
          data: { accessToken, tenantId: tenantId!, ...payload },
        })
      ),
    onSuccess: invalidate,
  })

  const isBusy =
    toggleModuleMutation.isPending ||
    toggleScreenMutation.isPending ||
    reorderMutation.isPending

  const moveScreen = (
    module: ManageableModule,
    index: number,
    direction: 'up' | 'down'
  ) => {
    const target = index + (direction === 'up' ? -1 : 1)
    if (target < 0 || target >= module.screens.length) {
      return
    }
    const orderedScreenIds = module.screens.map((screen) => screen.id)
    const moved = orderedScreenIds[index]
    orderedScreenIds[index] = orderedScreenIds[target]
    orderedScreenIds[target] = moved

    void reorderMutation.mutateAsync({ moduleId: module.id, orderedScreenIds })
  }

  if (!tenantId) {
    return (
      <WorkspaceEmptyState
        title="No active workspace"
        description="Select a tenant before managing modules."
      />
    )
  }

  const data = moduleQuery.data
  const enabledCount = data?.modules.filter((module) => module.isEnabled).length ?? 0

  return (
    <AccessGuard
      permissions={['module.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You do not have permission to manage modules."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Module & menu management"
        title="Control which modules and screens appear in navigation."
        description="Disable a module to hide it entirely, or hide and reorder individual screens within a module. Changes apply per workspace and take effect on the next navigation refresh. Access permissions still apply on top."
        metrics={[
          {
            label: 'Modules',
            value: String(data?.modules.length ?? 0),
            hint: 'Available modules',
            tone: 'neutral',
          },
          {
            label: 'Enabled',
            value: String(enabledCount),
            hint: 'Visible in this tenant',
            tone: 'red',
          },
        ]}
      >
        {moduleQuery.isPending ? (
          <WorkspacePanel eyebrow="Modules" title="Workspace modules">
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          </WorkspacePanel>
        ) : (
          (data?.modules ?? []).map((module) => {
            const ModuleIcon = resolveNavIcon(module.icon)

            return (
              <WorkspacePanel
                key={module.id}
                eyebrow="Module"
                title={module.name}
                description={module.description ?? undefined}
              >
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-border/65 bg-background/70 p-3">
                    <div className="flex items-center gap-3">
                      <ModuleIcon className="size-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{module.name}</p>
                          <Badge variant={module.isEnabled ? 'default' : 'secondary'}>
                            {module.isEnabled ? 'enabled' : 'disabled'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {module.code} · {module.screenCount} screens
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={module.isEnabled ? 'outline' : 'default'}
                      className="rounded-full"
                      disabled={!canManage || isBusy}
                      onClick={() =>
                        void toggleModuleMutation.mutateAsync({
                          moduleId: module.id,
                          isEnabled: !module.isEnabled,
                        })
                      }
                    >
                      {module.isEnabled ? 'Disable module' : 'Enable module'}
                    </Button>
                  </div>

                  <div
                    className={
                      module.isEnabled ? 'grid gap-2' : 'grid gap-2 opacity-55'
                    }
                  >
                    {module.screens.map((screen, index) => (
                      <ScreenRow
                        key={screen.id}
                        screen={screen}
                        canManage={canManage}
                        disabled={isBusy || !module.isEnabled}
                        isFirst={index === 0}
                        isLast={index === module.screens.length - 1}
                        onToggle={() =>
                          void toggleScreenMutation.mutateAsync({
                            screenId: screen.id,
                            showInMenu: !screen.showInMenu,
                          })
                        }
                        onMoveUp={() => moveScreen(module, index, 'up')}
                        onMoveDown={() => moveScreen(module, index, 'down')}
                      />
                    ))}
                  </div>
                </div>
              </WorkspacePanel>
            )
          })
        )}
      </WorkspacePage>
    </AccessGuard>
  )
}

function ScreenRow({
  screen,
  canManage,
  disabled,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  screen: ManageableScreen
  canManage: boolean
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/55 bg-background/60 p-2.5">
      <div className="flex items-center gap-2">
        {screen.showInMenu ? (
          <Eye className="size-4 text-muted-foreground" />
        ) : (
          <EyeOff className="size-4 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            {screen.name}
            {!screen.isActive ? (
              <Badge variant="secondary" className="ms-2">
                inactive
              </Badge>
            ) : null}
          </p>
          {screen.path ? (
            <code className="text-xs text-muted-foreground">{screen.path}</code>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          aria-label="Move up"
          disabled={!canManage || disabled || isFirst}
          onClick={onMoveUp}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          aria-label="Move down"
          disabled={!canManage || disabled || isLast}
          onClick={onMoveDown}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={screen.showInMenu ? 'outline' : 'default'}
          className="rounded-full"
          disabled={!canManage || disabled}
          onClick={onToggle}
        >
          {screen.showInMenu ? 'Hide' : 'Show'}
        </Button>
      </div>
    </div>
  )
}
