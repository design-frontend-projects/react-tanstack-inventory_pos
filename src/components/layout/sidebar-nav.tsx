"use client"

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import {
  appNavSections,
  dashboardNavItem,
  isAppPathActive,
} from '#/lib/navigation/app-nav'

export function SidebarNav() {
  const { t } = useTranslation()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <div className="flex flex-col gap-1.5">
      <SidebarGroup className="pt-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              isActive={isAppPathActive(pathname, dashboardNavItem.to)}
              className="rounded-[1rem] border border-transparent px-3 text-sidebar-foreground/88 data-[active=true]:border-sidebar-border/50 data-[active=true]:bg-sidebar-accent/80"
            >
              <Link to={dashboardNavItem.to}>
                <dashboardNavItem.icon />
                <span>{t(dashboardNavItem.titleKey, dashboardNavItem.fallbackTitle)}</span>
                <span className="ms-auto size-2 rounded-full bg-sidebar-primary" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {appNavSections.map((section) => {
        const hasActiveChild = section.items.some((item) =>
          isAppPathActive(pathname, item.to)
        )
        const SectionIcon = section.icon

        return (
          <SidebarGroup key={section.id} className="py-0">
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenu>
                <SidebarMenuItem className="rounded-[1.15rem] border border-transparent bg-white/[0.02] transition-colors hover:border-white/[0.06]">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="rounded-[1rem] px-3 text-sidebar-foreground/82 hover:text-sidebar-foreground"
                      isActive={hasActiveChild}
                    >
                      <SectionIcon />
                      <span>{t(section.titleKey, section.fallbackTitle)}</span>
                      <ChevronDown className="ms-auto text-sidebar-foreground/45 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub className="mx-3 mb-3 mt-1 border-sidebar-border/45 px-2">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon
                        const isActive = isAppPathActive(pathname, item.to)

                        return (
                          <SidebarMenuSubItem key={item.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive}
                              className="rounded-[0.95rem] px-2.5 text-sidebar-foreground/72 data-[active=true]:bg-sidebar-accent/70 data-[active=true]:text-sidebar-foreground"
                            >
                              <Link to={item.to}>
                                <ItemIcon />
                                <span>{t(item.titleKey, item.fallbackTitle)}</span>
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
