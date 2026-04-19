"use client"

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
  Boxes,
  ChevronDown,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  PlugZap,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBasket,
  BellRing,
  UsersRound,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import { useTranslation } from 'react-i18next'
import { Link, useRouterState } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'

const navSections = [
  {
    key: 'inventory',
    icon: Boxes,
    items: [
      { key: 'inventoryOverview', to: '/inventory', icon: PackageSearch },
      { key: 'inventoryCatalog', to: '/inventory/catalog', icon: ClipboardList },
      { key: 'inventoryOutlets', to: '/outlets', icon: MapPinned },
      { key: 'inventoryStock', to: '/inventory/stock', icon: ReceiptText },
    ],
  },
  {
    key: 'restaurant',
    icon: ChefHat,
    items: [
      { key: 'restaurantKitchen', to: '/restaurant/kitchen', icon: ChefHat },
      { key: 'restaurantMenu', to: '/restaurant/menu', icon: ShoppingBasket },
      { key: 'restaurantTables', to: '/restaurant/tables', icon: ReceiptText },
    ],
  },
  {
    key: 'pos',
    icon: ShoppingBasket,
    items: [
      { key: 'posCheckout', to: '/pos', icon: ShoppingBasket },
      { key: 'posOrders', to: '/pos/orders', icon: ClipboardList },
      { key: 'posReturns', to: '/pos/returns', icon: RotateCcw },
    ],
  },
  {
    key: 'systemAdmin',
    icon: ShieldCheck,
    items: [
      { key: 'systemUsers', to: '/settings/users', icon: UsersRound },
      { key: 'systemNotifications', to: '/settings/notifications', icon: BellRing },
      { key: 'systemIntegrations', to: '/settings/integrations', icon: PlugZap },
    ],
  },
] as const

export function SidebarNav() {
  const { t } = useTranslation()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <div className="flex flex-col gap-2">
      <SidebarGroup className="pt-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              isActive={pathname === '/dashboard'}
              className="rounded-2xl"
            >
              <Link to="/dashboard">
                <LayoutDashboard />
                <span>{t('nav.dashboard')}</span>
                <Badge variant="secondary" className="ms-auto">
                  Live
                </Badge>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {navSections.map((section) => {
        const SectionIcon = section.icon

        return (
          <SidebarGroup key={section.key} className="py-0">
            <Collapsible
              defaultOpen
              className="group/collapsible rounded-[1.35rem] border border-white/[0.06] bg-white/[0.03] p-1"
            >
              <SidebarMenu>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton size="lg" className="rounded-[1rem]">
                      <SectionIcon />
                      <span>{t(`nav.${section.key}`)}</span>
                      <ChevronDown className="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="mx-2 mb-2 mt-1 border-sidebar-border/60">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon
                        const isActive =
                          pathname === item.to || pathname.startsWith(`${item.to}/`)

                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <Link to={item.to}>
                                <ItemIcon />
                                <span>{t(`nav.${item.key}`)}</span>
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
