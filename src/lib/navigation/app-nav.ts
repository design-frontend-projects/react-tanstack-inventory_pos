import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Award,
  BadgePercent,
  Banknote,
  PartyPopper,
  UtensilsCrossed,
  BellRing,
  Bike,
  BookOpenCheck,
  BookUser,
  Boxes,
  Building2,
  CalendarClock,
  CalendarRange,
  Coins,
  FileText,
  FolderKanban,
  GitCompareArrows,
  HandCoins,
  Inbox,
  PiggyBank,
  Percent,
  Repeat,
  ScrollText,
  Settings2,
  TrendingDown,
  Wallet,
  TrendingUp,
  ClipboardCheck,
  FolderTree,
  Gift,
  ChartSpline,
  ChefHat,
  ClipboardList,
  BadgeCheck,
  Landmark,
  Layers,
  Network,
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
  Ruler,
  ShieldCheck,
  Tags,
  ShoppingBag,
  ShoppingBasket,
  UsersRound,
} from 'lucide-react'

export type AppNavRouteTo =
  | '/dashboard'
  | '/inventory'
  | '/inventory/catalog'
  | '/inventory/pricing'
  | '/inventory/categories'
  | '/inventory/brands'
  | '/inventory/units'
  | '/inventory/locations'
  | '/inventory/stock'
  | '/inventory/movements'
  | '/inventory/reservations'
  | '/inventory/adjustments'
  | '/inventory/transfers'
  | '/inventory/counts'
  | '/inventory/reports'
  | '/inventory/settings'
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
  | '/crm/dashboard'
  | '/crm/customers'
  | '/crm/loyalty'
  | '/crm/segments'
  | '/crm/analytics'
  | '/finance/dashboard'
  | '/finance/accounts'
  | '/finance/journal-types'
  | '/finance/journals'
  | '/finance/posting-queue'
  | '/finance/recurring-journals'
  | '/finance/receivables/customers'
  | '/finance/receivables/ledger'
  | '/finance/receivables/payments'
  | '/finance/receivables/credit-notes'
  | '/finance/receivables/statements'
  | '/finance/payables/vendors'
  | '/finance/payables/ledger'
  | '/finance/payables/payments'
  | '/finance/payables/debit-notes'
  | '/finance/cash/accounts'
  | '/finance/cash/transactions'
  | '/finance/cash/sessions'
  | '/finance/cash/petty-cash'
  | '/finance/banking/accounts'
  | '/finance/banking/transactions'
  | '/finance/banking/reconciliation'
  | '/finance/banking/cheques'
  | '/finance/cost/cost-centers'
  | '/finance/cost/departments'
  | '/finance/cost/projects'
  | '/finance/budgets/plans'
  | '/finance/budgets/monitoring'
  | '/finance/assets/categories'
  | '/finance/assets/register'
  | '/finance/assets/depreciation'
  | '/finance/fiscal'
  | '/finance/closing'
  | '/finance/settings'
  | '/finance/settings/tax'
  | '/finance/reports'
  | '/hr'
  | '/hr/organization'
  | '/hr/departments'
  | '/hr/positions'
  | '/hr/job-grades'
  | '/hr/cost-centers'
  | '/hr/employees'
  | '/hr/recruitment'
  | '/hr/onboarding'
  | '/hr/attendance'
  | '/hr/leave'
  | '/hr/payroll'
  | '/hr/performance'
  | '/hr/training'
  | '/hr/career'
  | '/hr/workforce'
  | '/hr/budgeting'
  | '/hr/self-service'
  | '/hr/assets'
  | '/hr/expenses'
  | '/hr/analytics'
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
  | 'finance'
  | 'hr'
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
        id: 'inventory-pricing',
        sectionId: 'inventory',
        to: '/inventory/pricing',
        icon: BadgePercent,
        titleKey: 'nav.inventoryPricing',
        fallbackTitle: 'Product Pricing',
        keywords: ['pricing', 'price lists', 'tiers', 'currency'],
        permissions: ['product.view', 'product.manage_pricing'],
      },
      {
        id: 'inventory-categories',
        sectionId: 'inventory',
        to: '/inventory/categories',
        icon: FolderTree,
        titleKey: 'nav.inventoryCategories',
        fallbackTitle: 'Categories',
        keywords: ['categories', 'hierarchy', 'tree', 'classification'],
        permissions: ['product.view'],
      },
      {
        id: 'inventory-brands',
        sectionId: 'inventory',
        to: '/inventory/brands',
        icon: Tags,
        titleKey: 'nav.inventoryBrands',
        fallbackTitle: 'Brands',
        keywords: ['brands', 'manufacturers', 'labels'],
        permissions: ['product.view'],
      },
      {
        id: 'inventory-units',
        sectionId: 'inventory',
        to: '/inventory/units',
        icon: Ruler,
        titleKey: 'nav.inventoryUnits',
        fallbackTitle: 'Units',
        keywords: ['units', 'uom', 'measure', 'conversions'],
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
        id: 'inventory-locations',
        sectionId: 'inventory',
        to: '/inventory/locations',
        icon: MapPinned,
        titleKey: 'nav.inventoryLocations',
        fallbackTitle: 'Warehouse Locations',
        keywords: ['locations', 'zones', 'racks', 'shelves', 'bins'],
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
        id: 'inventory-reservations',
        sectionId: 'inventory',
        to: '/inventory/reservations',
        icon: PackageCheck,
        titleKey: 'nav.inventoryReservations',
        fallbackTitle: 'Stock Reservations',
        keywords: ['reservations', 'holds', 'allocation', 'reserved'],
        permissions: ['inventory.view_stock'],
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
      {
        id: 'inventory-settings',
        sectionId: 'inventory',
        to: '/inventory/settings',
        icon: SlidersHorizontal,
        titleKey: 'nav.inventorySettings',
        fallbackTitle: 'Settings',
        keywords: ['settings', 'reorder rules', 'snapshots', 'housekeeping'],
        permissions: ['inventory.view_stock', 'inventory.manage_reorder'],
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
    permissions: [
      'purchase.po_view',
      'purchase.requisition_view',
      'supplier.view',
    ],
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
        keywords: [
          'floor plan',
          'areas',
          'sections',
          'tables',
          'staff',
          'waiters',
        ],
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
        id: 'crm-dashboard',
        sectionId: 'crm',
        to: '/crm/dashboard',
        icon: LayoutDashboard,
        titleKey: 'nav.crmDashboard',
        fallbackTitle: 'CRM Dashboard',
        keywords: ['crm', 'dashboard', 'overview', 'kpis', 'churn', 'revenue'],
        permissions: ['crm.analytics_view'],
      },
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
    id: 'finance',
    icon: Landmark,
    titleKey: 'nav.finance',
    fallbackTitle: 'Financial Management',
    rootTo: '/finance/dashboard',
    keywords: [
      'finance',
      'accounting',
      'ledger',
      'gl',
      'journals',
      'ar',
      'ap',
      'cash',
      'bank',
      'budget',
      'assets',
      'reports',
    ],
    permissions: ['finance.account_view', 'finance.journal_view'],
    items: [
      {
        id: 'finance-dashboard',
        sectionId: 'finance',
        to: '/finance/dashboard',
        icon: LayoutDashboard,
        titleKey: 'nav.financeDashboard',
        fallbackTitle: 'Finance Dashboard',
        keywords: ['cfo', 'dashboard', 'overview', 'kpis', 'profit', 'cash'],
        permissions: ['finance.account_view', 'finance.journal_view'],
      },
      {
        id: 'finance-accounts',
        sectionId: 'finance',
        to: '/finance/accounts',
        icon: Landmark,
        titleKey: 'nav.financeAccounts',
        fallbackTitle: 'Chart of Accounts',
        keywords: ['chart of accounts', 'gl', 'accounts', 'ledger', 'coa'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-journal-types',
        sectionId: 'finance',
        to: '/finance/journal-types',
        icon: ListOrdered,
        titleKey: 'nav.financeJournalTypes',
        fallbackTitle: 'Journal Types',
        keywords: ['journal types', 'daybooks', 'numbering', 'series'],
        permissions: ['finance.journal_view'],
      },
      {
        id: 'finance-journals',
        sectionId: 'finance',
        to: '/finance/journals',
        icon: BookOpenCheck,
        titleKey: 'nav.financeJournals',
        fallbackTitle: 'Journal Entries',
        keywords: ['journal', 'entries', 'posting', 'double entry', 'voucher'],
        permissions: ['finance.journal_view'],
      },
      {
        id: 'finance-posting-queue',
        sectionId: 'finance',
        to: '/finance/posting-queue',
        icon: Inbox,
        titleKey: 'nav.financePostingQueue',
        fallbackTitle: 'Posting Queue',
        keywords: ['posting queue', 'events', 'automation', 'exceptions'],
        permissions: ['finance.posting_manage', 'finance.journal_view'],
      },
      {
        id: 'finance-recurring',
        sectionId: 'finance',
        to: '/finance/recurring-journals',
        icon: Repeat,
        titleKey: 'nav.financeRecurring',
        fallbackTitle: 'Recurring Journals',
        keywords: ['recurring', 'templates', 'accruals', 'schedule'],
        permissions: ['finance.journal_create'],
      },
      {
        id: 'finance-ar-customers',
        sectionId: 'finance',
        to: '/finance/receivables/customers',
        icon: UsersRound,
        titleKey: 'nav.financeArCustomers',
        fallbackTitle: 'AR Customers',
        keywords: ['receivable', 'customers', 'aging', 'credit'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-customer-ledger',
        sectionId: 'finance',
        to: '/finance/receivables/ledger',
        icon: BookUser,
        titleKey: 'nav.financeCustomerLedger',
        fallbackTitle: 'Customer Ledger',
        keywords: ['customer ledger', 'receivable', 'open items'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-customer-payments',
        sectionId: 'finance',
        to: '/finance/receivables/payments',
        icon: HandCoins,
        titleKey: 'nav.financeCustomerPayments',
        fallbackTitle: 'Customer Payments',
        keywords: ['receipts', 'customer payments', 'allocation'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-credit-notes',
        sectionId: 'finance',
        to: '/finance/receivables/credit-notes',
        icon: ReceiptText,
        titleKey: 'nav.financeCreditNotes',
        fallbackTitle: 'Credit Notes',
        keywords: ['credit notes', 'refund', 'receivable'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-customer-statements',
        sectionId: 'finance',
        to: '/finance/receivables/statements',
        icon: FileText,
        titleKey: 'nav.financeCustomerStatements',
        fallbackTitle: 'Customer Statements',
        keywords: ['statements', 'receivable', 'dunning'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-vendors',
        sectionId: 'finance',
        to: '/finance/payables/vendors',
        icon: Truck,
        titleKey: 'nav.financeVendors',
        fallbackTitle: 'Vendors',
        keywords: ['payable', 'vendors', 'suppliers', 'aging'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-vendor-ledger',
        sectionId: 'finance',
        to: '/finance/payables/ledger',
        icon: BookUser,
        titleKey: 'nav.financeVendorLedger',
        fallbackTitle: 'Vendor Ledger',
        keywords: ['vendor ledger', 'payable', 'open items'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-vendor-payments',
        sectionId: 'finance',
        to: '/finance/payables/payments',
        icon: HandCoins,
        titleKey: 'nav.financeVendorPayments',
        fallbackTitle: 'Vendor Payments',
        keywords: ['vendor payments', 'payment run', 'remittance'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-debit-notes',
        sectionId: 'finance',
        to: '/finance/payables/debit-notes',
        icon: ReceiptText,
        titleKey: 'nav.financeDebitNotes',
        fallbackTitle: 'Debit Notes',
        keywords: ['debit notes', 'payable', 'vendor return'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-cash-accounts',
        sectionId: 'finance',
        to: '/finance/cash/accounts',
        icon: Wallet,
        titleKey: 'nav.financeCashAccounts',
        fallbackTitle: 'Cash Accounts',
        keywords: ['cash', 'cashbox', 'till', 'float'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-cash-transactions',
        sectionId: 'finance',
        to: '/finance/cash/transactions',
        icon: ArrowLeftRight,
        titleKey: 'nav.financeCashTransactions',
        fallbackTitle: 'Cash Transactions',
        keywords: ['cash transactions', 'receipts', 'disbursements'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-cash-sessions',
        sectionId: 'finance',
        to: '/finance/cash/sessions',
        icon: ClipboardCheck,
        titleKey: 'nav.financeCashSessions',
        fallbackTitle: 'Cash Sessions',
        keywords: ['cash sessions', 'count', 'variance', 'closing'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-petty-cash',
        sectionId: 'finance',
        to: '/finance/cash/petty-cash',
        icon: Coins,
        titleKey: 'nav.financePettyCash',
        fallbackTitle: 'Petty Cash',
        keywords: ['petty cash', 'imprest', 'replenish'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-bank-accounts',
        sectionId: 'finance',
        to: '/finance/banking/accounts',
        icon: Landmark,
        titleKey: 'nav.financeBankAccounts',
        fallbackTitle: 'Bank Accounts',
        keywords: ['bank', 'accounts', 'iban', 'balance'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-bank-transactions',
        sectionId: 'finance',
        to: '/finance/banking/transactions',
        icon: ArrowLeftRight,
        titleKey: 'nav.financeBankTransactions',
        fallbackTitle: 'Bank Transactions',
        keywords: ['bank transactions', 'deposits', 'withdrawals'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-bank-reconciliation',
        sectionId: 'finance',
        to: '/finance/banking/reconciliation',
        icon: GitCompareArrows,
        titleKey: 'nav.financeBankReconciliation',
        fallbackTitle: 'Bank Reconciliation',
        keywords: ['reconciliation', 'matching', 'statement'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-cheques',
        sectionId: 'finance',
        to: '/finance/banking/cheques',
        icon: ScrollText,
        titleKey: 'nav.financeCheques',
        fallbackTitle: 'Cheques',
        keywords: ['cheques', 'pdc', 'post dated', 'clearing'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-cost-centers',
        sectionId: 'finance',
        to: '/finance/cost/cost-centers',
        icon: Network,
        titleKey: 'nav.financeCostCenters',
        fallbackTitle: 'Cost Centers',
        keywords: ['cost centers', 'dimensions', 'allocation'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-departments',
        sectionId: 'finance',
        to: '/finance/cost/departments',
        icon: FolderTree,
        titleKey: 'nav.financeDepartments',
        fallbackTitle: 'Departments',
        keywords: ['departments', 'dimensions', 'analysis'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-projects',
        sectionId: 'finance',
        to: '/finance/cost/projects',
        icon: FolderKanban,
        titleKey: 'nav.financeProjects',
        fallbackTitle: 'Projects',
        keywords: ['projects', 'profitability', 'budget'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-budget-plans',
        sectionId: 'finance',
        to: '/finance/budgets/plans',
        icon: PiggyBank,
        titleKey: 'nav.financeBudgetPlans',
        fallbackTitle: 'Budget Plans',
        keywords: ['budget', 'plans', 'forecast', 'monthly'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-budget-monitoring',
        sectionId: 'finance',
        to: '/finance/budgets/monitoring',
        icon: TrendingUp,
        titleKey: 'nav.financeBudgetMonitoring',
        fallbackTitle: 'Budget Monitoring',
        keywords: ['budget', 'variance', 'monitoring', 'actual'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-asset-categories',
        sectionId: 'finance',
        to: '/finance/assets/categories',
        icon: Layers,
        titleKey: 'nav.financeAssetCategories',
        fallbackTitle: 'Asset Categories',
        keywords: ['assets', 'categories', 'depreciation method'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-assets',
        sectionId: 'finance',
        to: '/finance/assets/register',
        icon: Building2,
        titleKey: 'nav.financeAssets',
        fallbackTitle: 'Assets',
        keywords: ['fixed assets', 'register', 'disposal'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-depreciation',
        sectionId: 'finance',
        to: '/finance/assets/depreciation',
        icon: TrendingDown,
        titleKey: 'nav.financeDepreciation',
        fallbackTitle: 'Depreciation',
        keywords: ['depreciation', 'schedule', 'run'],
        permissions: ['finance.account_view'],
      },
      {
        id: 'finance-fiscal',
        sectionId: 'finance',
        to: '/finance/fiscal',
        icon: CalendarRange,
        titleKey: 'nav.financeFiscal',
        fallbackTitle: 'Fiscal Calendar',
        keywords: ['fiscal year', 'periods', 'closing', 'locks'],
        permissions: ['finance.fiscal_manage', 'finance.journal_view'],
      },
      {
        id: 'finance-closing',
        sectionId: 'finance',
        to: '/finance/closing',
        icon: ClipboardCheck,
        titleKey: 'nav.financeClosing',
        fallbackTitle: 'Closing Wizard',
        keywords: ['closing', 'year end', 'period close', 'checklist'],
        permissions: ['finance.fiscal_manage'],
      },
      {
        id: 'finance-settings',
        sectionId: 'finance',
        to: '/finance/settings',
        icon: Settings2,
        titleKey: 'nav.financeSettings',
        fallbackTitle: 'Financial Settings',
        keywords: [
          'settings',
          'default accounts',
          'currencies',
          'exchange rates',
          'posting rules',
          'account mapping',
        ],
        permissions: ['finance.settings_manage', 'finance.posting_manage'],
      },
      {
        id: 'finance-tax-settings',
        sectionId: 'finance',
        to: '/finance/settings/tax',
        icon: Percent,
        titleKey: 'nav.financeTaxSettings',
        fallbackTitle: 'Tax Settings',
        keywords: ['tax', 'vat', 'withholding', 'returns'],
        permissions: ['finance.settings_manage'],
      },
      {
        id: 'finance-reports',
        sectionId: 'finance',
        to: '/finance/reports',
        icon: ChartSpline,
        titleKey: 'nav.financeReports',
        fallbackTitle: 'Financial Reports',
        keywords: [
          'reports',
          'trial balance',
          'balance sheet',
          'income statement',
          'p&l',
        ],
        permissions: ['finance.journal_view'],
      },
    ],
  },
  {
    id: 'hr',
    icon: UsersRound,
    titleKey: 'nav.hr',
    fallbackTitle: 'Human Resources',
    rootTo: '/hr',
    keywords: [
      'hr',
      'human resources',
      'hcm',
      'people',
      'employees',
      'payroll',
    ],
    permissions: ['hr.analytics_view', 'hr.employee_view', 'hr.org_view'],
    items: [
      {
        id: 'hr-overview',
        sectionId: 'hr',
        to: '/hr',
        icon: ChartSpline,
        titleKey: 'nav.hr',
        fallbackTitle: 'HR Overview',
        keywords: ['hr overview', 'dashboard', 'headcount', 'workforce'],
        permissions: ['hr.analytics_view'],
      },
      {
        id: 'hr-organization',
        sectionId: 'hr',
        to: '/hr/organization',
        icon: Network,
        titleKey: 'nav.hrOrganization',
        fallbackTitle: 'Organization',
        keywords: [
          'organization',
          'org chart',
          'hierarchy',
          'companies',
          'branches',
        ],
        permissions: ['hr.org_view'],
      },
      {
        id: 'hr-departments',
        sectionId: 'hr',
        to: '/hr/departments',
        icon: FolderTree,
        titleKey: 'nav.hrDepartments',
        fallbackTitle: 'Departments',
        keywords: ['departments', 'sections', 'divisions', 'units'],
        permissions: ['hr.org_view'],
      },
      {
        id: 'hr-positions',
        sectionId: 'hr',
        to: '/hr/positions',
        icon: BadgeCheck,
        titleKey: 'nav.hrPositions',
        fallbackTitle: 'Positions',
        keywords: ['positions', 'jobs', 'roles', 'titles'],
        permissions: ['hr.org_view'],
      },
      {
        id: 'hr-job-grades',
        sectionId: 'hr',
        to: '/hr/job-grades',
        icon: Layers,
        titleKey: 'nav.hrJobGrades',
        fallbackTitle: 'Job Grades',
        keywords: ['job grades', 'salary bands', 'levels', 'pay scale'],
        permissions: ['hr.org_view'],
      },
      {
        id: 'hr-cost-centers',
        sectionId: 'hr',
        to: '/hr/cost-centers',
        icon: Landmark,
        titleKey: 'nav.hrCostCenters',
        fallbackTitle: 'Cost Centers',
        keywords: ['cost centers', 'budget', 'allocation'],
        permissions: ['hr.org_view'],
      },
      {
        id: 'hr-employees',
        sectionId: 'hr',
        to: '/hr/employees',
        icon: UsersRound,
        titleKey: 'nav.hrEmployees',
        fallbackTitle: 'Employees',
        keywords: ['employees', 'staff', 'people', 'profiles', 'headcount'],
        permissions: ['hr.employee_view'],
      },
      {
        id: 'hr-recruitment',
        sectionId: 'hr',
        to: '/hr/recruitment',
        icon: ClipboardList,
        titleKey: 'nav.hrRecruitment',
        fallbackTitle: 'Recruitment',
        keywords: [
          'recruitment',
          'ats',
          'vacancies',
          'candidates',
          'interviews',
          'offers',
        ],
        permissions: ['hr.recruitment_view'],
      },
      {
        id: 'hr-onboarding',
        sectionId: 'hr',
        to: '/hr/onboarding',
        icon: ClipboardCheck,
        titleKey: 'nav.hrOnboarding',
        fallbackTitle: 'Onboarding',
        keywords: ['onboarding', 'tasks', 'new hire', 'checklist'],
        permissions: ['hr.recruitment_view'],
      },
      {
        id: 'hr-attendance',
        sectionId: 'hr',
        to: '/hr/attendance',
        icon: CalendarClock,
        titleKey: 'nav.hrAttendance',
        fallbackTitle: 'Time & Attendance',
        keywords: ['attendance', 'time', 'shifts', 'punches', 'overtime'],
        permissions: ['hr.attendance_view'],
      },
      {
        id: 'hr-leave',
        sectionId: 'hr',
        to: '/hr/leave',
        icon: PackageCheck,
        titleKey: 'nav.hrLeave',
        fallbackTitle: 'Leave',
        keywords: ['leave', 'time off', 'vacation', 'balances', 'requests'],
        permissions: ['hr.leave_view'],
      },
      {
        id: 'hr-payroll',
        sectionId: 'hr',
        to: '/hr/payroll',
        icon: Banknote,
        titleKey: 'nav.hrPayroll',
        fallbackTitle: 'Payroll',
        keywords: ['payroll', 'salary', 'payslip', 'runs', 'components'],
        permissions: ['hr.payroll_view'],
      },
      {
        id: 'hr-performance',
        sectionId: 'hr',
        to: '/hr/performance',
        icon: TrendingUp,
        titleKey: 'nav.hrPerformance',
        fallbackTitle: 'Performance',
        keywords: ['performance', 'goals', 'kpis', 'reviews', 'appraisal'],
        permissions: ['hr.performance_view'],
      },
      {
        id: 'hr-training',
        sectionId: 'hr',
        to: '/hr/training',
        icon: Award,
        titleKey: 'nav.hrTraining',
        fallbackTitle: 'Learning',
        keywords: ['training', 'learning', 'courses', 'certificates'],
        permissions: ['hr.training_manage'],
      },
      {
        id: 'hr-career',
        sectionId: 'hr',
        to: '/hr/career',
        icon: BadgeCheck,
        titleKey: 'nav.hrCareer',
        fallbackTitle: 'Career',
        keywords: ['career', 'succession', 'promotions', 'talent'],
        permissions: ['hr.employee_view'],
      },
      {
        id: 'hr-workforce',
        sectionId: 'hr',
        to: '/hr/workforce',
        icon: Network,
        titleKey: 'nav.hrWorkforce',
        fallbackTitle: 'Workforce Planning',
        keywords: ['workforce', 'planning', 'skills', 'headcount', 'gap'],
        permissions: ['hr.employee_view'],
      },
      {
        id: 'hr-budgeting',
        sectionId: 'hr',
        to: '/hr/budgeting',
        icon: Landmark,
        titleKey: 'nav.hrBudgeting',
        fallbackTitle: 'HR Budgeting',
        keywords: ['budget', 'salary budget', 'variance', 'actual'],
        permissions: ['hr.analytics_view'],
      },
      {
        id: 'hr-self-service',
        sectionId: 'hr',
        to: '/hr/self-service',
        icon: BellRing,
        titleKey: 'nav.hrSelfService',
        fallbackTitle: 'Self Service',
        keywords: ['self service', 'ess', 'requests', 'announcements'],
        permissions: ['hr.employee_view'],
      },
      {
        id: 'hr-assets',
        sectionId: 'hr',
        to: '/hr/assets',
        icon: PackageSearch,
        titleKey: 'nav.hrAssets',
        fallbackTitle: 'Assets',
        keywords: ['assets', 'laptop', 'vehicle', 'accountability'],
        permissions: ['hr.employee_view'],
      },
      {
        id: 'hr-expenses',
        sectionId: 'hr',
        to: '/hr/expenses',
        icon: ReceiptText,
        titleKey: 'nav.hrExpenses',
        fallbackTitle: 'Travel & Expense',
        keywords: ['expense', 'travel', 'claims', 'reimbursement'],
        permissions: ['hr.expense_view'],
      },
      {
        id: 'hr-analytics',
        sectionId: 'hr',
        to: '/hr/analytics',
        icon: ChartSpline,
        titleKey: 'nav.hrAnalytics',
        fallbackTitle: 'HR Analytics',
        keywords: ['analytics', 'headcount', 'turnover', 'dashboard'],
        permissions: ['hr.analytics_view'],
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
