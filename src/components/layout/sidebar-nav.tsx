'use client'

import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '#/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import type { AppNavRouteTo } from '#/lib/navigation/app-nav'
import {
  appNavSections,
  dashboardNavItem,
  isAppPathActive,
} from '#/lib/navigation/app-nav'
import { resolveNavIcon } from '#/lib/navigation/icon-map'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { useNavigationTree } from '#/features/layout/use-navigation-tree'
import { hasAnyPermission } from '#/features/auth/permissions'

type SidebarItemView = {
  id: string
  to: AppNavRouteTo
  icon: LucideIcon
  titleKey?: string
  fallbackTitle: string
}

type SidebarSectionView = {
  id: string
  icon: LucideIcon
  titleKey?: string
  fallbackTitle: string
  items: Array<SidebarItemView>
}

export function SidebarNav() {
  const { t } = useTranslation()
  const session = useSessionBootstrap()
  const context = session.context
  const navQuery = useNavigationTree(session.activeTenantId)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const label = (fallbackTitle: string, titleKey?: string) =>
    titleKey ? t(titleKey, fallbackTitle) : fallbackTitle

  // DB-driven sections (already permission-filtered server-side). The 'overview'
  // module holds the standalone dashboard link, rendered separately below.
  const dbSections: Array<SidebarSectionView> = (navQuery.data?.modules ?? [])
    .filter((module) => module.code !== 'overview')
    .map((module) => ({
      id: module.code,
      icon: resolveNavIcon(module.icon),
      titleKey: module.titleKey ?? undefined,
      fallbackTitle: module.name,
      items: module.screens.map((screen) => ({
        id: screen.code,
        to: screen.path as AppNavRouteTo,
        icon: resolveNavIcon(screen.icon),
        titleKey: screen.titleKey ?? undefined,
        fallbackTitle: screen.name,
      })),
    }))

  // Static fallback (client-filtered) used until the DB tree loads or if it errors.
  const staticSections: Array<SidebarSectionView> = appNavSections
    .filter(
      (section) =>
        !section.permissions?.length ||
        hasAnyPermission(context?.permissions ?? [], section.permissions),
    )
    .map((section) => ({
      id: section.id,
      icon: section.icon,
      titleKey: section.titleKey,
      fallbackTitle: section.fallbackTitle,
      items: section.items
        .filter(
          (item) =>
            !item.permissions?.length ||
            hasAnyPermission(context?.permissions ?? [], item.permissions),
        )
        .map((item) => ({
          id: item.id,
          to: item.to,
          icon: item.icon,
          titleKey: item.titleKey,
          fallbackTitle: item.fallbackTitle,
        })),
    }))
    .filter((section) => section.items.length > 0)

  const sections = dbSections.length > 0 ? dbSections : staticSections

  return (
    <div className="flex flex-col gap-1.5">
      <SidebarGroup className="pt-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              isActive={isAppPathActive(pathname, dashboardNavItem.to)}
              className="rounded-xl border border-transparent px-3 text-sidebar-foreground/90 hover:bg-sidebar-accent data-[active=true]:border-primary/20 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            >
              <Link to={dashboardNavItem.to}>
                <dashboardNavItem.icon />
                <span>
                  {t(dashboardNavItem.titleKey, dashboardNavItem.fallbackTitle)}
                </span>
                <span className="ms-auto size-2 rounded-full bg-sidebar-primary" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {sections.map((section) => {
        const hasActiveChild = section.items.some((item) =>
          isAppPathActive(pathname, item.to),
        )
        const SectionIcon = section.icon

        return (
          <SidebarGroup key={section.id} className="py-0">
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenu>
                <SidebarMenuItem className="rounded-xl border border-transparent transition-colors hover:border-sidebar-border">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="rounded-xl px-3 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:text-primary"
                      isActive={hasActiveChild}
                    >
                      <SectionIcon />
                      <span>
                        {label(section.fallbackTitle, section.titleKey)}
                      </span>
                      <ChevronDown className="ms-auto text-sidebar-foreground/45 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub className="mx-3 mb-3 mt-1 border-sidebar-border px-2">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon
                        const isActive = isAppPathActive(pathname, item.to)

                        return (
                          <SidebarMenuSubItem key={item.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive}
                              className="rounded-lg px-2.5 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary"
                            >
                              <Link to={item.to}>
                                <ItemIcon />
                                <span>
                                  {label(item.fallbackTitle, item.titleKey)}
                                </span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </SidebarMenu>
            </Collapsible>
          </SidebarGroup>
        )
      })}
    </div>
  )
}
