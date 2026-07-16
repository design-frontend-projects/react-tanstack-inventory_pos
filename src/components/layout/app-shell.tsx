'use client'

import { useTranslation } from 'react-i18next'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { SidebarNav } from '#/components/layout/sidebar-nav'
import { TopCommand } from '#/components/layout/top-command'
import { WorkspaceSwitcher } from '#/components/layout/workspace-switcher'
import { LanguageSwitcher } from '#/components/layout/language-switcher'
import { ThemeToggle } from '#/components/layout/theme-toggle'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { signOut } from '#/features/auth/browser-auth'
import { useLayoutStore } from '#/features/layout/layout-store'
import { useNavigationTree } from '#/features/layout/use-navigation-tree'
import { findActiveNavFromTree } from '#/features/layout/navigation-view'
import { getAppNavContext } from '#/lib/navigation/app-nav'
import { Button } from '#/components/ui/button'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, memberships, activeMembership, setActiveTenantId } =
    useSessionBootstrap()
  const direction = useLayoutStore((state) => state.direction)
  const sidebarOpen = useLayoutStore((state) => state.sidebarOpen)
  const setSidebarOpen = useLayoutStore((state) => state.setSidebarOpen)
  const sidebarOpenMobile = useLayoutStore((state) => state.sidebarOpenMobile)
  const setSidebarOpenMobile = useLayoutStore(
    (state) => state.setSidebarOpenMobile,
  )
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const navQuery = useNavigationTree(activeMembership?.tenantId ?? null)

  // Resolve the active screen/module from the DB nav tree; fall back to the
  // static catalog while it loads or if the route isn't in the tree.
  const staticContext = getAppNavContext(pathname)
  const activeNav = findActiveNavFromTree(navQuery.data, pathname)
  const label = (fallbackTitle: string, titleKey?: string) =>
    titleKey ? t(titleKey, fallbackTitle) : fallbackTitle

  const activeLabel = activeNav
    ? label(activeNav.screenFallback, activeNav.screenTitleKey)
    : t(
        staticContext.activeItem.titleKey,
        staticContext.activeItem.fallbackTitle,
      )
  const activeSectionLabel = activeNav
    ? activeNav.moduleFallback
      ? label(activeNav.moduleFallback, activeNav.moduleTitleKey)
      : t('actions.overview')
    : staticContext.activeSection
      ? t(
          staticContext.activeSection.titleKey,
          staticContext.activeSection.fallbackTitle,
        )
      : t('actions.overview')
  const sidebarSide = direction === 'rtl' ? 'right' : 'left'
  const activeTenantName = activeMembership?.tenantName ?? 'No active workspace'
  const activeRoleLabel = activeMembership?.roleLabel ?? 'No role'

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      openMobile={sidebarOpenMobile}
      onOpenMobileChange={setSidebarOpenMobile}
    >
      <Sidebar
        side={sidebarSide}
        dir={direction}
        collapsible="icon"
        variant="inset"
        className="border-e-0 md:p-3"
      >
        <div className="ops-sidebar-shell flex size-full flex-col rounded-2xl border border-sidebar-border">
          <SidebarHeader className="gap-4 px-3 pt-3">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-4">
              <p className="ops-kicker">{t('app.title')}</p>
              <h1 className="mt-2 text-base font-semibold text-sidebar-foreground md:text-lg">
                {t('app.deckTitle')}
              </h1>
              <p className="mt-1 text-sm leading-6 text-sidebar-foreground/70">
                {t('app.subtitle')}
              </p>
            </div>
            <WorkspaceSwitcher />
          </SidebarHeader>

          <SidebarContent className="px-2 pb-3">
            <SidebarNav />
          </SidebarContent>

          <SidebarFooter className="gap-3 px-3 pb-3">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent p-3 text-sidebar-foreground">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 rounded-full border border-sidebar-border bg-primary/10">
                  <AvatarFallback className="rounded-full bg-transparent font-semibold text-primary">
                    AK
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user?.displayName ?? 'Signed-out user'}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/70">
                    {user?.email ?? 'No email'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-sidebar-border pt-3">
                <Badge variant="secondary" className="capitalize">
                  {activeRoleLabel}
                </Badge>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {activeTenantName}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-3 w-full justify-between text-sidebar-foreground/80 hover:bg-sidebar-accent-foreground/5 hover:text-sidebar-foreground"
                onClick={async () => {
                  await signOut()
                  void navigate({ to: '/sign-in' })
                }}
              >
                Sign out
                <LogOut className="size-4" />
              </Button>
            </div>
          </SidebarFooter>

          <SidebarRail />
        </div>
      </Sidebar>

      <SidebarInset className="min-h-svh bg-transparent">
        <header className="ops-topbar sticky top-0 z-20 px-4 py-3 md:px-8 md:py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,30rem)_auto]">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="rounded-full border border-border/70 bg-background/75 shadow-none" />
              <div className="min-w-0">
                <p className="ops-kicker">{t('header.sectionLabel')}</p>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <strong className="truncate text-sm font-semibold md:text-base">
                    {activeLabel}
                  </strong>
                  <span className="hidden rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground md:inline-flex">
                    {activeSectionLabel}
                  </span>
                  <span className="hidden truncate text-sm text-muted-foreground xl:inline">
                    {activeTenantName}
                  </span>
                </div>
              </div>
            </div>

            <TopCommand
              pathname={pathname}
              memberships={memberships}
              activeTenantId={activeMembership?.tenantId ?? ''}
              onNavigate={(to) => void navigate({ to })}
              onSelectWorkspace={setActiveTenantId}
              className="order-3 col-span-full lg:order-2 lg:col-span-1 lg:max-w-120 lg:justify-self-center"
            />

            <div className="order-2 flex flex-wrap items-center justify-end gap-2 md:order-3">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="px-4 pb-8 pt-5 md:px-8 md:pt-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
