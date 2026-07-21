import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Award,
  BadgePercent,
  PartyPopper,
  UtensilsCrossed,
  BellRing,
  Bike,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  Gift,
  ChartSpline,
  ChefHat,
  ClipboardList,
  PackageCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  HeartHandshake,
  LayoutDashboard,
  ListOrdered,
  MapPinned,
  PackageSearch,
  PlugZap,
  QrCode,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  UsersRound,
} from 'lucide-react'

export type AppNavRouteTo =
  | '/dashboard'
  | '/inventory'
  | '/inventory/catalog'
  | '/inventory/stock'
  | '/inventory/movements'
  | '/inventory/adjustments'
  | '/inventory/transfers'
  | '/inventory/counts'
  | '/inventory/reports'
  | '/outlets'
  | '/purchase'
  | '/purchase/requisitions'
  | '/purchase/orders'
  | '/purchase/receipts'
  | '/purchase/returns'
  | '/purchase/suppliers'
  | '/purchase/rfqs'
  | '/purchase/quotations'
  | '/purchase/approvals'
  | '/purchase/invoices'
  | '/purchase/payments'
  | '/restaurant/dashboard'
  | '/restaurant/kitchen'
  | '/restaurant/menu'
  | '/restaurant/tables'
  | '/restaurant/orders'
  | '/restaurant/floor-plan'
  | '/restaurant/reports'
  | '/restaurant/analytics'
  | '/restaurant/reservations'
  | '/restaurant/waitlist'
  | '/restaurant/takeaway'
  | '/restaurant/delivery'
  | '/restaurant/qr'
  | '/restaurant/promotions'
  | '/restaurant/gift-cards'
  | '/restaurant/events'
  | '/restaurant/catering'
  | '/pos'
  | '/pos/orders'
  | '/pos/returns'
  | '/crm/customers'
  | '/crm/loyalty'
  | '/crm/segments'
  | '/crm/analytics'
  | '/profile'
  | '/settings/security'
  | '/settings/roles'
  | '/settings/modules'
  | '/settings/access'
  | '/settings/users'
  | '/settings/notifications'
  | '/settings/integrations'

export type AppNavSectionId =
  | 'overview'
  | 'inventory'
  | 'purchasing'
  | 'restaurant'
  | 'pos'
  | 'crm'
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
    permissions: ['inventory.view_stock', 'product.view', 'warehouse.view'],
    items: [
      {
        id: 'inventory-overview',
        sectionId: 'inventory',
        to: '/inventory',
        icon: PackageSearch,
        titleKey: 'nav.inventoryOverview',
        fallbackTitle: 'Overview',
        keywords: ['inventory overview', 'coverage', 'reorder', 'stock'],
        permissions: ['inventory.view_stock'],
      },
      {
        id: 'inventory-catalog',
        sectionId: 'inventory',
        to: '/inventory/catalog',
        icon: ClipboardList,
        titleKey: 'nav.inventoryCatalog',
        fallbackTitle: 'Catalog',
        keywords: ['catalog', 'products', 'assortment', 'sku'],
        permissions: ['product.view'],
      },
      {
        id: 'inventory-outlets',
        sectionId: 'inventory',
        to: '/outlets',
        icon: MapPinned,
        titleKey: 'nav.inventoryOutlets',
        fallbackTitle: 'Outlets',
        keywords: ['outlets', 'stores', 'locations', 'coverage'],
        permissions: ['warehouse.view'],
      },
      {
        id: 'inventory-stock',
        sectionId: 'inventory',
        to: '/inventory/stock',
        icon: ReceiptText,
        titleKey: 'nav.inventoryStock',
        fallbackTitle: 'Stock Ledger',
        keywords: ['stock ledger', 'movements', 'thresholds', 'balance'],
        permissions: ['inventory.view_stock', 'inventory.view_movements'],
      },
      {
        id: 'inventory-movements',
        sectionId: 'inventory',
        to: '/inventory/movements',
        icon: ArrowLeftRight,
        titleKey: 'nav.inventoryMovements',
        fallbackTitle: 'Movements',
        keywords: ['movements', 'ledger', 'audit', 'transactions', 'history'],
        permissions: ['inventory.view_movements'],
      },
      {
        id: 'inventory-adjustments',
        sectionId: 'inventory',
        to: '/inventory/adjustments',
        icon: SlidersHorizontal,
        titleKey: 'nav.inventoryAdjustments',
        fallbackTitle: 'Adjustments',
        keywords: ['adjustments', 'damage', 'expiry', 'write off', 'shrinkage'],
        permissions: ['adjustment.view'],
      },
      {
        id: 'inventory-transfers',
        sectionId: 'inventory',
        to: '/inventory/transfers',
        icon: Truck,
        titleKey: 'nav.inventoryTransfers',
        fallbackTitle: 'Transfers',
        keywords: ['transfers', 'ship', 'receive', 'in transit', 'warehouse'],
        permissions: ['transfer.view'],
      },
      {
        id: 'inventory-counts',
        sectionId: 'inventory',
        to: '/inventory/counts',
        icon: ClipboardCheck,
        titleKey: 'nav.inventoryCounts',
        fallbackTitle: 'Stock Counts',
        keywords: ['stock count', 'cycle count', 'variance', 'physical count'],
        permissions: ['inventory.count_view'],
      },
      {
        id: 'inventory-reports',
        sectionId: 'inventory',
        to: '/inventory/reports',
        icon: ChartSpline,
        titleKey: 'nav.inventoryReports',
        fallbackTitle: 'Reports',
        keywords: ['reports', 'valuation', 'reorder', 'analytics', 'aging'],
        permissions: ['inventory.view_valuation', 'inventory.view_stock'],
      },
    ],
  },
  {
    id: 'purchasing',
    icon: ShoppingCart,
    titleKey: 'nav.purchase',
    fallbackTitle: 'Purchasing',
    rootTo: '/purchase',
    keywords: ['purchasing', 'procurement', 'suppliers', 'orders', 'invoices'],
    permissions: ['purchase.po_view', 'purchase.requisition_view', 'supplier.view'],
    items: [
      {
        id: 'purchase-overview',
        sectionId: 'purchasing',
        to: '/purchase',
        icon: PackageSearch,
        titleKey: 'nav.purchaseOverview',
        fallbackTitle: 'Overview',
        keywords: ['purchasing overview', 'spend', 'ap aging', 'exceptions'],
        permissions: ['purchase.po_view', 'purchase.invoice_view'],
      },
      {
        id: 'purchase-requisitions',
        sectionId: 'purchasing',
        to: '/purchase/requisitions',
        icon: ClipboardList,
        titleKey: 'nav.purchaseRequisitions',
        fallbackTitle: 'Requisitions',
        keywords: ['requisitions', 'pr', 'requests', 'approval'],
        permissions: ['purchase.requisition_view'],
      },
      {
        id: 'purchase-orders',
        sectionId: 'purchasing',
        to: '/purchase/orders',
        icon: ShoppingCart,
        titleKey: 'nav.purchaseOrders',
        fallbackTitle: 'Purchase Orders',
        keywords: ['purchase orders', 'po', 'buying', 'supplier orders'],
        permissions: ['purchase.po_view'],
      },
      {
        id: 'purchase-receipts',
        sectionId: 'purchasing',
        to: '/purchase/receipts',
        icon: PackageCheck,
        titleKey: 'nav.purchaseReceipts',
        fallbackTitle: 'Goods Receipts',
        keywords: ['goods receipt', 'grn', 'receiving', 'inbound'],
        permissions: ['purchase.po_receive'],
      },
      {
        id: 'purchase-returns',
        sectionId: 'purchasing',
        to: '/purchase/returns',
        icon: RotateCcw,
        titleKey: 'nav.purchaseReturns',
        fallbackTitle: 'Purchase Returns',
        keywords: ['purchase returns', 'debit note', 'supplier return'],
        permissions: ['purchase.return_manage'],
      },
      {
        id: 'purchase-suppliers',
        sectionId: 'purchasing',
        to: '/purchase/suppliers',
        icon: UsersRound,
        titleKey: 'nav.purchaseSuppliers',
        fallbackTitle: 'Suppliers',
        keywords: ['suppliers', 'vendors', 'contacts', 'crm'],
        permissions: ['supplier.view'],
      },
      {
        id: 'purchase-rfqs',
        sectionId: 'purchasing',
        to: '/purchase/rfqs',
        icon: ClipboardList,
        titleKey: 'nav.purchaseRfqs',
        fallbackTitle: 'RFQs',
        keywords: ['rfq', 'request for quotation', 'sourcing', 'bids'],
        permissions: ['purchase.rfq_view'],
      },
      {
        id: 'purchase-quotations',
        sectionId: 'purchasing',
        to: '/purchase/quotations',
        icon: ReceiptText,
        titleKey: 'nav.purchaseQuotations',
        fallbackTitle: 'Quotations',
        keywords: ['quotations', 'quotes', 'comparison', 'award'],
        permissions: ['purchase.quotation_view'],
      },
      {
        id: 'purchase-approvals',
        sectionId: 'purchasing',
        to: '/purchase/approvals',
        icon: ShieldCheck,
        titleKey: 'nav.purchaseApprovals',
        fallbackTitle: 'Approvals',
        keywords: ['approvals', 'workflow', 'inbox', 'escalation'],
        permissions: ['purchase.approval_action'],
      },
      {
        id: 'purchase-invoices',
        sectionId: 'purchasing',
        to: '/purchase/invoices',
        icon: ReceiptText,
        titleKey: 'nav.purchaseInvoices',
        fallbackTitle: 'Supplier Invoices',
        keywords: ['invoices', 'ap', 'three way match', 'billing'],
        permissions: ['purchase.invoice_view'],
      },
      {
        id: 'purchase-payments',
        sectionId: 'purchasing',
        to: '/purchase/payments',
        icon: BadgePercent,
        titleKey: 'nav.purchasePayments',
        fallbackTitle: 'Payments',
        keywords: ['payments', 'settlement', 'remittance', 'ap'],
        permissions: ['purchase.payment_view'],
      },
    ],
  },
  {
    id: 'restaurant',
    icon: ChefHat,
    titleKey: 'nav.restaurant',
    fallbackTitle: 'Restaurant',
    rootTo: '/restaurant/dashboard',
    keywords: ['restaurant', 'kitchen', 'menu', 'tables', 'service', 'floor'],
    permissions: ['res.dashboard.view'],
    items: [
      {
        id: 'restaurant-dashboard',
        sectionId: 'restaurant',
        to: '/restaurant/dashboard',
        icon: LayoutDashboard,
        titleKey: 'nav.restaurantDashboard',
        fallbackTitle: 'Restaurant Dashboard',
        keywords: ['dashboard', 'kpi', 'sales', 'live', 'overview'],
        permissions: ['res.dashboard.view'],
      },
      {
        id: 'restaurant-tables',
        sectionId: 'restaurant',
        to: '/restaurant/tables',
        icon: ReceiptText,
        titleKey: 'nav.restaurantTables',
        fallbackTitle: 'Live Floor',
        keywords: ['tables', 'service', 'covers', 'floor', 'seating'],
        permissions: ['res.orders.view', 'res.floor.manage'],
      },
      {
        id: 'restaurant-orders',
        sectionId: 'restaurant',
        to: '/restaurant/orders',
        icon: ClipboardList,
        titleKey: 'nav.restaurantOrders',
        fallbackTitle: 'Orders',
        keywords: ['orders', 'tickets', 'takeaway', 'delivery', 'payment'],
        permissions: ['res.orders.view'],
      },
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
        fallbackTitle: 'Menu',
        keywords: ['menu', 'items', 'pricing', 'engineering'],
        permissions: ['res.menu.view', 'res.dashboard.view'],
      },
      {
        id: 'restaurant-floor-plan',
        sectionId: 'restaurant',
        to: '/restaurant/floor-plan',
        icon: MapPinned,
        titleKey: 'nav.restaurantFloorPlan',
        fallbackTitle: 'Floor Plan',
        keywords: ['floor plan', 'areas', 'sections', 'tables', 'staff', 'waiters'],
        permissions: ['res.settings.manage', 'res.floor.manage'],
      },
      {
        id: 'restaurant-reservations',
        sectionId: 'restaurant',
        to: '/restaurant/reservations',
        icon: CalendarClock,
        titleKey: 'nav.restaurantReservations',
        fallbackTitle: 'Reservations',
        keywords: ['reservations', 'bookings', 'calendar', 'guests'],
        permissions: ['res.reservations.view', 'res.reservations.manage'],
      },
      {
        id: 'restaurant-waitlist',
        sectionId: 'restaurant',
        to: '/restaurant/waitlist',
        icon: ListOrdered,
        titleKey: 'nav.restaurantWaitlist',
        fallbackTitle: 'Waitlist',
        keywords: ['waitlist', 'queue', 'walk-in', 'host'],
        permissions: ['res.reservations.view', 'res.reservations.manage'],
      },
      {
        id: 'restaurant-takeaway',
        sectionId: 'restaurant',
        to: '/restaurant/takeaway',
        icon: ShoppingBag,
        titleKey: 'nav.restaurantTakeaway',
        fallbackTitle: 'Takeaway',
        keywords: ['takeaway', 'pickup', 'counter', 'to-go'],
        permissions: ['res.takeaway.view', 'res.takeaway.manage'],
      },
      {
        id: 'restaurant-delivery',
        sectionId: 'restaurant',
        to: '/restaurant/delivery',
        icon: Bike,
        titleKey: 'nav.restaurantDelivery',
        fallbackTitle: 'Delivery',
        keywords: ['delivery', 'dispatch', 'drivers', 'zones'],
        permissions: ['res.delivery.view', 'res.delivery.manage'],
      },
      {
        id: 'restaurant-qr',
        sectionId: 'restaurant',
        to: '/restaurant/qr',
        icon: QrCode,
        titleKey: 'nav.restaurantQr',
        fallbackTitle: 'QR Ordering',
        keywords: ['qr', 'codes', 'campaigns', 'ordering'],
        permissions: ['res.qr.manage'],
      },
      {
        id: 'restaurant-promotions',
        sectionId: 'restaurant',
        to: '/restaurant/promotions',
        icon: BadgePercent,
        titleKey: 'nav.restaurantPromotions',
        fallbackTitle: 'Promotions',
        keywords: ['promotions', 'discounts', 'coupons', 'offers'],
        permissions: ['res.promotions.view', 'res.promotions.manage'],
      },
      {
        id: 'restaurant-gift-cards',
        sectionId: 'restaurant',
        to: '/restaurant/gift-cards',
        icon: Gift,
        titleKey: 'nav.restaurantGiftCards',
        fallbackTitle: 'Gift Cards',
        keywords: ['gift cards', 'stored value', 'reload', 'redeem'],
        permissions: ['res.giftcards.view', 'res.giftcards.manage'],
      },
      {
        id: 'restaurant-events',
        sectionId: 'restaurant',
        to: '/restaurant/events',
        icon: PartyPopper,
        titleKey: 'nav.restaurantEvents',
        fallbackTitle: 'Events & Parties',
        keywords: ['events', 'parties', 'weddings', 'banquet', 'halls'],
        permissions: ['res.events.view', 'res.events.manage'],
      },
      {
        id: 'restaurant-catering',
        sectionId: 'restaurant',
        to: '/restaurant/catering',
        icon: UtensilsCrossed,
        titleKey: 'nav.restaurantCatering',
        fallbackTitle: 'Catering',
        keywords: ['catering', 'corporate', 'outside events', 'jobs'],
        permissions: ['res.catering.view', 'res.catering.manage'],
      },
      {
        id: 'restaurant-reports',
        sectionId: 'restaurant',
        to: '/restaurant/reports',
        icon: ClipboardList,
        titleKey: 'nav.restaurantReports',
        fallbackTitle: 'Reports',
        keywords: ['reports', 'sales', 'items', 'daily'],
        permissions: ['res.reports.view'],
      },
      {
        id: 'restaurant-analytics',
        sectionId: 'restaurant',
        to: '/restaurant/analytics',
        icon: ChartSpline,
        titleKey: 'nav.restaurantAnalytics',
        fallbackTitle: 'Analytics',
        keywords: ['analytics', 'trends', 'heat map', 'performance'],
        permissions: ['res.analytics.view', 'res.reports.view'],
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
    id: 'crm',
    icon: HeartHandshake,
    titleKey: 'nav.crm',
    fallbackTitle: 'CRM',
    rootTo: '/crm/customers',
    keywords: ['crm', 'customers', 'loyalty', 'segments', 'analytics'],
    permissions: ['crm.view', 'crm.loyalty_view'],
    items: [
      {
        id: 'crm-customers',
        sectionId: 'crm',
        to: '/crm/customers',
        icon: HeartHandshake,
        titleKey: 'nav.crmCustomers',
        fallbackTitle: 'Customers 360',
        keywords: [
          'crm',
          'customers',
          '360',
          'profiles',
          'timeline',
          'consent',
        ],
        permissions: ['crm.view'],
      },
      {
        id: 'crm-loyalty',
        sectionId: 'crm',
        to: '/crm/loyalty',
        icon: Award,
        titleKey: 'nav.crmLoyalty',
        fallbackTitle: 'Loyalty',
        keywords: ['loyalty', 'points', 'tiers', 'rewards', 'wallet'],
        permissions: ['crm.loyalty_view'],
      },
      {
        id: 'crm-segments',
        sectionId: 'crm',
        to: '/crm/segments',
        icon: UsersRound,
        titleKey: 'nav.crmSegments',
        fallbackTitle: 'Segments',
        keywords: ['segments', 'audiences', 'targeting', 'rules'],
        permissions: ['crm.segment_view'],
      },
      {
        id: 'crm-analytics',
        sectionId: 'crm',
        to: '/crm/analytics',
        icon: ChartSpline,
        titleKey: 'nav.crmAnalytics',
        fallbackTitle: 'Customer Analytics',
        keywords: ['analytics', 'clv', 'rfm', 'churn', 'retention', 'kpis'],
        permissions: ['crm.analytics_view'],
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
        id: 'settings-security',
        sectionId: 'systemAdmin',
        to: '/settings/security',
        icon: ShieldCheck,
        titleKey: 'nav.systemSecurity',
        fallbackTitle: 'Security Center',
        keywords: [
          'security',
          'rbac',
          'modules',
          'screens',
          'registry',
          'audit',
        ],
        permissions: [
          'tenant.manage_settings',
          'res.settings.manage',
          'user.view',
        ],
      },
      {
        id: 'settings-roles',
        sectionId: 'systemAdmin',
        to: '/settings/roles',
        icon: UsersRound,
        titleKey: 'nav.systemRoles',
        fallbackTitle: 'Roles',
        keywords: ['roles', 'rbac', 'permissions', 'custom roles'],
        permissions: ['role.view', 'role.manage'],
      },
      {
        id: 'settings-modules',
        sectionId: 'systemAdmin',
        to: '/settings/modules',
        icon: Boxes,
        titleKey: 'nav.systemModules',
        fallbackTitle: 'Modules',
        keywords: ['modules', 'menus', 'navigation'],
        permissions: ['module.manage'],
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
    (left, right) => right.to.length - left.to.length,
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
