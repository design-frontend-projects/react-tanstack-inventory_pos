import type { LucideIcon } from 'lucide-react'
import {
  BellRing,
  Boxes,
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
  UsersRound,
} from 'lucide-react'

export type AppNavRouteTo =
  | '/dashboard'
  | '/inventory'
  | '/inventory/catalog'
  | '/inventory/stock'
  | '/outlets'
  | '/restaurant/kitchen'
  | '/restaurant/menu'
  | '/restaurant/tables'
  | '/pos'
  | '/pos/orders'
  | '/pos/returns'
  | '/profile'
  | '/settings/access'
  | '/settings/users'
  | '/settings/notifications'
  | '/settings/integrations'

export type AppNavSectionId =
  | 'overview'
  | 'inventory'
  | 'restaurant'
  | 'pos'
  | 'systemAdmin'

export type AppCommandGroup = 'navigation' | 'pages' | 'workspaces'

export type AppNavItem = {
  id: string
  sectionId: AppNavSectionId
  to: AppNavRouteTo
  icon: LucideIcon
  titleKey: string
  fallbackTitle: string
  keywords: string[]
  permissions?: string[]
}

export type AppNavSection = {
  id: AppNavSectionId
  icon: LucideIcon
  titleKey: string
  fallbackTitle: string
  rootTo: AppNavRouteTo
  keywords: string[]
  permissions?: string[]
  items: AppNavItem[]
}

export type AppCommandEntry = {
  id: string
  group: AppCommandGroup
  icon: LucideIcon
  title: string
  description?: string
  keywords: string[]
  to?: AppNavRouteTo
  tenantId?: string
  current?: boolean
  permissions?: string[]
}

export const dashboardNavItem: AppNavItem = {
  id: 'dashboard',
  sectionId: 'overview',
  to: '/dashboard',
  icon: LayoutDashboard,
  titleKey: 'nav.dashboard',
  fallbackTitle: 'Dashboard',
  keywords: ['dashboard', 'overview', 'control room', 'briefing'],
  permissions: ['dashboard.view', 'res.dashboard.view'],
}

export const appNavSections: AppNavSection[] = [
  {
    id: 'inventory',
    icon: Boxes,
    titleKey: 'nav.inventory',
    fallbackTitle: 'Inventory',
    rootTo: '/inventory',
    keywords: ['inventory', 'stock', 'catalog', 'supply', 'outlets'],
    permissions: ['tenant.view', 'res.dashboard.view'],
    items: [
      {
        id: 'inventory-overview',
        sectionId: 'inventory',
        to: '/inventory',
        icon: PackageSearch,
        titleKey: 'nav.inventoryOverview',
        fallbackTitle: 'Overview',
        keywords: ['inventory overview', 'coverage', 'reorder', 'stock'],
        permissions: ['tenant.view', 'res.dashboard.view'],
      },
      {
        id: 'inventory-catalog',
        sectionId: 'inventory',
        to: '/inventory/catalog',
        icon: ClipboardList,
        titleKey: 'nav.inventoryCatalog',
        fallbackTitle: 'Catalog',
        keywords: ['catalog', 'products', 'assortment', 'sku'],
        permissions: ['tenant.view', 'res.dashboard.view'],
      },
      {
        id: 'inventory-outlets',
        sectionId: 'inventory',
        to: '/outlets',
        icon: MapPinned,
        titleKey: 'nav.inventoryOutlets',
        fallbackTitle: 'Outlets',
        keywords: ['outlets', 'stores', 'locations', 'coverage'],
        permissions: ['tenant.view', 'res.dashboard.view'],
      },
      {
        id: 'inventory-stock',
        sectionId: 'inventory',
        to: '/inventory/stock',
        icon: ReceiptText,
        titleKey: 'nav.inventoryStock',
        fallbackTitle: 'Stock Ledger',
        keywords: ['stock ledger', 'movements', 'thresholds', 'balance'],
        permissions: ['tenant.view', 'res.dashboard.view'],
      },
    ],
  },
  {
    id: 'restaurant',
    icon: ChefHat,
    titleKey: 'nav.restaurant',
    fallbackTitle: 'Restaurant',
    rootTo: '/restaurant/kitchen',
    keywords: ['restaurant', 'kitchen', 'menu', 'tables', 'service'],
    permissions: ['res.dashboard.view'],
    items: [
      {
        id: 'restaurant-kitchen',
        sectionId: 'restaurant',
        to: '/restaurant/kitchen',
        icon: ChefHat,
        titleKey: 'nav.restaurantKitchen',
        fallbackTitle: 'Kitchen Board',
        keywords: ['kitchen', 'board', 'prep', 'queue'],
        permissions: ['res.kitchen.access'],
      },
      {
        id: 'restaurant-menu',
        sectionId: 'restaurant',
        to: '/restaurant/menu',
        icon: ShoppingBasket,
        titleKey: 'nav.restaurantMenu',
        fallbackTitle: 'Menu Engineering',
        keywords: ['menu', 'items', 'pricing', 'engineering'],
        permissions: ['res.dashboard.view'],
      },
      {
        id: 'restaurant-tables',
        sectionId: 'restaurant',
        to: '/restaurant/tables',
        icon: ReceiptText,
        titleKey: 'nav.restaurantTables',
        fallbackTitle: 'Table Service',
        keywords: ['tables', 'service', 'covers', 'floor'],
        permissions: ['res.floor.manage'],
      },
    ],
  },
  {
    id: 'pos',
    icon: ShoppingBasket,
    titleKey: 'nav.pos',
    fallbackTitle: 'POS',
    rootTo: '/pos',
    keywords: ['checkout', 'pos', 'orders', 'returns', 'cashier'],
    permissions: ['dashboard.view', 'res.dashboard.view'],
    items: [
      {
        id: 'pos-checkout',
        sectionId: 'pos',
        to: '/pos',
        icon: ShoppingBasket,
        titleKey: 'nav.posCheckout',
        fallbackTitle: 'Checkout',
        keywords: ['checkout', 'basket', 'draft', 'scan'],
        permissions: ['dashboard.view', 'res.dashboard.view'],
      },
      {
        id: 'pos-orders',
        sectionId: 'pos',
        to: '/pos/orders',
        icon: ClipboardList,
        titleKey: 'nav.posOrders',
        fallbackTitle: 'Orders',
        keywords: ['orders', 'queue', 'tickets', 'history'],
        permissions: ['dashboard.view', 'res.orders.view'],
      },
      {
        id: 'pos-returns',
        sectionId: 'pos',
        to: '/pos/returns',
        icon: RotateCcw,
        titleKey: 'nav.posReturns',
        fallbackTitle: 'Returns',
        keywords: ['returns', 'refunds', 'voids', 'exceptions'],
        permissions: ['dashboard.view', 'res.orders.cancel'],
      },
    ],
  },
  {
    id: 'systemAdmin',
    icon: ShieldCheck,
    titleKey: 'nav.systemAdmin',
    fallbackTitle: 'System Admin',
    rootTo: '/settings/users',
    keywords: ['system', 'users', 'notifications', 'integrations', 'admin'],
    permissions: ['tenant.manage_settings', 'res.settings.manage', 'user.view'],
    items: [
      {
        id: 'settings-profile',
        sectionId: 'systemAdmin',
        to: '/profile',
        icon: UsersRound,
        titleKey: 'nav.profile',
        fallbackTitle: 'My Profile',
        keywords: ['profile', 'account', 'self service', 'identity'],
        permissions: ['profile.view_self'],
      },
      {
        id: 'settings-access',
        sectionId: 'systemAdmin',
        to: '/settings/access',
        icon: ShieldCheck,
        titleKey: 'nav.systemAccess',
        fallbackTitle: 'Access Control',
        keywords: ['access', 'permissions', 'overrides', 'rbac'],
        permissions: ['user.view'],
      },
      {
        id: 'settings-users',
        sectionId: 'systemAdmin',
        to: '/settings/users',
        icon: UsersRound,
        titleKey: 'nav.systemUsers',
        fallbackTitle: 'Users & Roles',
        keywords: ['users', 'roles', 'permissions', 'access'],
        permissions: ['user.view'],
      },
      {
        id: 'settings-notifications',
        sectionId: 'systemAdmin',
        to: '/settings/notifications',
        icon: BellRing,
        titleKey: 'nav.systemNotifications',
        fallbackTitle: 'Notifications',
        keywords: ['notifications', 'alerts', 'delivery', 'signals'],
        permissions: ['tenant.manage_settings', 'res.settings.manage'],
      },
      {
        id: 'settings-integrations',
        sectionId: 'systemAdmin',
        to: '/settings/integrations',
        icon: PlugZap,
        titleKey: 'nav.systemIntegrations',
        fallbackTitle: 'Integrations',
        keywords: ['integrations', 'apis', 'connections', 'webhooks'],
        permissions: ['tenant.manage_settings', 'res.settings.manage'],
      },
    ],
  },
]

export const flatAppNavItems = [
  dashboardNavItem,
  ...appNavSections.flatMap((section) => section.items),
]

export function isAppPathActive(pathname: string, to: AppNavRouteTo) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function getAppNavSection(sectionId: AppNavSectionId) {
  if (sectionId === 'overview') {
    return undefined
  }

  return appNavSections.find((section) => section.id === sectionId)
}

export function findActiveNavItem(pathname: string) {
  const rankedItems = [...flatAppNavItems].sort(
    (left, right) => right.to.length - left.to.length
  )

  return rankedItems.find((item) => isAppPathActive(pathname, item.to))
}

export function getAppNavContext(pathname: string) {
  const activeItem = findActiveNavItem(pathname) ?? dashboardNavItem
  const activeSection =
    activeItem.sectionId === 'overview'
      ? undefined
      : getAppNavSection(activeItem.sectionId)

  return {
    activeItem,
    activeSection,
  }
}
