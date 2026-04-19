"use client"

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
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { SidebarNav } from '#/components/layout/sidebar-nav'
import { WorkspaceSwitcher } from '#/components/layout/workspace-switcher'
import { LanguageSwitcher } from '#/components/layout/language-switcher'
import { ThemeToggle } from '#/components/layout/theme-toggle'
import { useLayoutStore } from '#/features/layout/layout-store'
import { useRouterState } from '@tanstack/react-router'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Operations overview',
  '/inventory': 'Inventory overview',
  '/inventory/catalog': 'Catalog architecture',
  '/inventory/stock': 'Stock visibility',
  '/outlets': 'Outlet coverage',
  '/restaurant/kitchen': 'Kitchen board',
  '/restaurant/menu': 'Menu engineering',
  '/restaurant/tables': 'Table service',
  '/pos': 'Live checkout',
  '/pos/orders': 'Order queue',
  '/pos/returns': 'Return handling',
  '/settings/users': 'Access control',
  '/settings/notifications': 'Notification control',
  '/settings/integrations': 'Integration posture',
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeMembership } = useSessionBootstrap()
  const direction = useLayoutStore((state) => state.direction)
  const sidebarOpen = useLayoutStore((state) => state.sidebarOpen)
  const setSidebarOpen = useLayoutStore((state) => state.setSidebarOpen)
  const sidebarOpenMobile = useLayoutStore((state) => state.sidebarOpenMobile)
  const setSidebarOpenMobile = useLayoutStore(
    (state) => state.setSidebarOpenMobile
  )
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const activeLabel = routeLabels[pathname] ?? 'Command surface'
  const sidebarSide = direction === 'rtl' ? 'right' : 'left'

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
        <div className="ops-sidebar-shell flex size-full flex-col rounded-[1.65rem] border border-white/[0.06]">
          <SidebarHeader className="gap-3 px-3 pt-3">
            <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.04] px-3 py-4">
              <p className="ops-kicker text-sidebar-foreground/55">Control Room</p>
              <h1 className="mt-2 text-lg font-semibold text-sidebar-foreground">
                Meridian Operations Stack
              </h1>
              <p className="mt-1 text-sm text-sidebar-foreground/60">
                Inventory, restaurant, POS, and admin workflows stay in one
                deliberate shell.
              </p>
            </div>
            <WorkspaceSwitcher />
          </SidebarHeader>
          <SidebarContent className="px-2 pb-2">
            <SidebarNav />
          </SidebarContent>
          <SidebarFooter className="gap-3 px-3 pb-3">
            <div className="rounded-[1.45rem] border border-white/[0.08] bg-white/[0.04] p-3 text-sidebar-foreground">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 rounded-2xl border border-white/[0.10] bg-white/[0.08]">
                  <AvatarFallback className="rounded-2xl bg-transparent text-sidebar-foreground">
                    AK
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user.displayName}
                  </p>
                  <p className="truncate text-xs text-sidebar-foreground/62">
                    {user.title}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant="secondary" className="capitalize">
                  {activeMembership.role}
                </Badge>
                <span className="text-xs text-sidebar-foreground/62">
                  {activeMembership.defaultOutletLabel}
                </span>
              </div>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </div>
      </Sidebar>

      <SidebarInset className="min-h-svh bg-transparent">
        <header className="ops-topbar sticky top-0 z-20 px-4 py-4 md:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <SidebarTrigger className="rounded-full border border-border/60 bg-background/70" />
            <div className="min-w-0">
              <p className="ops-kicker">Active section</p>
              <div className="flex flex-wrap items-center gap-3">
                <strong className="truncate text-sm font-semibold md:text-base">
                  {activeLabel}
                </strong>
                <span className="hidden text-sm text-muted-foreground md:inline">
                  {activeMembership.tenantName}
                </span>
              </div>
            </div>
            <div className="ms-auto flex flex-wrap items-center gap-2">
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
