import type { PermissionCode } from '#/features/auth/rbac-catalog'

// Plain-data bootstrap catalog for the dynamic RBAC registry (modules / screens /
// actions / permission links). Intentionally free of React or Lucide imports so it
// is safe to import from the `tsx prisma/seed.ts` runner. `icon` values are Lucide
// icon *names* (strings), decoupled from the component references used in
// `src/lib/navigation/app-nav.ts`. In the DB-authoritative model this is bootstrap
// input for the seed, not the runtime source of truth.

export type PermissionKindCode =
  | 'screen'
  | 'menu'
  | 'action'
  | 'api'
  | 'data'
  | 'admin'

export type ModuleDefinition = {
  code: string
  name: string
  description: string
  icon: string
  displayOrder: number
  titleKey: string
  rootPath: string
}

export type ScreenDefinition = {
  moduleCode: string
  code: string
  name: string
  path: string
  titleKey: string
  icon: string
  displayOrder: number
  keywords: Array<string>
  defaultPermissionCode: PermissionCode | null
}

export type ScreenActionDefinition = {
  screenCode: string
  code: string
  name: string
  actionKey: string
  description: string
  displayOrder: number
}

export type PermissionLink = {
  moduleCode: string
  screenCode: string | null
  actionCode: string | null
  kind: PermissionKindCode
}

export const MODULE_DEFINITIONS: ReadonlyArray<ModuleDefinition> = [
  {
    code: 'overview',
    name: 'Overview',
    description: 'Cross-tenant control room and dashboards.',
    icon: 'LayoutDashboard',
    displayOrder: 0,
    titleKey: 'nav.dashboard',
    rootPath: '/dashboard',
  },
  {
    code: 'inventory',
    name: 'Inventory',
    description: 'Stock, catalog, outlets, and supply coverage.',
    icon: 'Boxes',
    displayOrder: 1,
    titleKey: 'nav.inventory',
    rootPath: '/inventory',
  },
  {
    code: 'restaurant',
    name: 'Restaurant',
    description: 'Kitchen, menu engineering, and floor service.',
    icon: 'ChefHat',
    displayOrder: 2,
    titleKey: 'nav.restaurant',
    rootPath: '/restaurant/kitchen',
  },
  {
    code: 'pos',
    name: 'POS',
    description: 'Checkout, orders, and returns.',
    icon: 'ShoppingBasket',
    displayOrder: 3,
    titleKey: 'nav.pos',
    rootPath: '/pos',
  },
  {
    code: 'system_admin',
    name: 'System Admin',
    description: 'Users, roles, access control, and configuration.',
    icon: 'ShieldCheck',
    displayOrder: 4,
    titleKey: 'nav.systemAdmin',
    rootPath: '/settings/security',
  },
] as const

export const SCREEN_DEFINITIONS: ReadonlyArray<ScreenDefinition> = [
  {
    moduleCode: 'overview',
    code: 'dashboard',
    name: 'Dashboard',
    path: '/dashboard',
    titleKey: 'nav.dashboard',
    icon: 'LayoutDashboard',
    displayOrder: 0,
    keywords: ['dashboard', 'overview', 'control room', 'briefing'],
    defaultPermissionCode: 'dashboard.view',
  },
  {
    moduleCode: 'inventory',
    code: 'inventory-overview',
    name: 'Overview',
    path: '/inventory',
    titleKey: 'nav.inventoryOverview',
    icon: 'PackageSearch',
    displayOrder: 0,
    keywords: ['inventory overview', 'coverage', 'reorder', 'stock'],
    defaultPermissionCode: 'tenant.view',
  },
  {
    moduleCode: 'inventory',
    code: 'inventory-catalog',
    name: 'Catalog',
    path: '/inventory/catalog',
    titleKey: 'nav.inventoryCatalog',
    icon: 'ClipboardList',
    displayOrder: 1,
    keywords: ['catalog', 'products', 'assortment', 'sku'],
    defaultPermissionCode: 'tenant.view',
  },
  {
    moduleCode: 'inventory',
    code: 'inventory-outlets',
    name: 'Outlets',
    path: '/outlets',
    titleKey: 'nav.inventoryOutlets',
    icon: 'MapPinned',
    displayOrder: 2,
    keywords: ['outlets', 'stores', 'locations', 'coverage'],
    defaultPermissionCode: 'tenant.view',
  },
  {
    moduleCode: 'inventory',
    code: 'inventory-stock',
    name: 'Stock Ledger',
    path: '/inventory/stock',
    titleKey: 'nav.inventoryStock',
    icon: 'ReceiptText',
    displayOrder: 3,
    keywords: ['stock ledger', 'movements', 'thresholds', 'balance'],
    defaultPermissionCode: 'tenant.view',
  },
  {
    moduleCode: 'restaurant',
    code: 'restaurant-kitchen',
    name: 'Kitchen Board',
    path: '/restaurant/kitchen',
    titleKey: 'nav.restaurantKitchen',
    icon: 'ChefHat',
    displayOrder: 0,
    keywords: ['kitchen', 'board', 'prep', 'queue'],
    defaultPermissionCode: 'res.kitchen.access',
  },
  {
    moduleCode: 'restaurant',
    code: 'restaurant-menu',
    name: 'Menu Engineering',
    path: '/restaurant/menu',
    titleKey: 'nav.restaurantMenu',
    icon: 'ShoppingBasket',
    displayOrder: 1,
    keywords: ['menu', 'items', 'pricing', 'engineering'],
    defaultPermissionCode: 'res.dashboard.view',
  },
  {
    moduleCode: 'restaurant',
    code: 'restaurant-tables',
    name: 'Table Service',
    path: '/restaurant/tables',
    titleKey: 'nav.restaurantTables',
    icon: 'ReceiptText',
    displayOrder: 2,
    keywords: ['tables', 'service', 'covers', 'floor'],
    defaultPermissionCode: 'res.floor.manage',
  },
  {
    moduleCode: 'pos',
    code: 'pos-checkout',
    name: 'Checkout',
    path: '/pos',
    titleKey: 'nav.posCheckout',
    icon: 'ShoppingBasket',
    displayOrder: 0,
    keywords: ['checkout', 'basket', 'draft', 'scan'],
    defaultPermissionCode: 'dashboard.view',
  },
  {
    moduleCode: 'pos',
    code: 'pos-orders',
    name: 'Orders',
    path: '/pos/orders',
    titleKey: 'nav.posOrders',
    icon: 'ClipboardList',
    displayOrder: 1,
    keywords: ['orders', 'queue', 'tickets', 'history'],
    defaultPermissionCode: 'res.orders.view',
  },
  {
    moduleCode: 'pos',
    code: 'pos-returns',
    name: 'Returns',
    path: '/pos/returns',
    titleKey: 'nav.posReturns',
    icon: 'RotateCcw',
    displayOrder: 2,
    keywords: ['returns', 'refunds', 'voids', 'exceptions'],
    defaultPermissionCode: 'res.orders.cancel',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-security',
    name: 'Security Center',
    path: '/settings/security',
    titleKey: 'nav.systemSecurity',
    icon: 'ShieldCheck',
    displayOrder: 0,
    keywords: ['security', 'rbac', 'modules', 'screens', 'registry', 'audit'],
    defaultPermissionCode: 'user.view',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-roles',
    name: 'Roles',
    path: '/settings/roles',
    titleKey: 'nav.systemRoles',
    icon: 'UsersRound',
    displayOrder: 1,
    keywords: ['roles', 'rbac', 'permissions', 'grants', 'custom roles'],
    defaultPermissionCode: 'role.view',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-modules',
    name: 'Modules',
    path: '/settings/modules',
    titleKey: 'nav.systemModules',
    icon: 'Boxes',
    displayOrder: 2,
    keywords: ['modules', 'menus', 'navigation', 'enable', 'disable'],
    defaultPermissionCode: 'module.manage',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-profile',
    name: 'My Profile',
    path: '/profile',
    titleKey: 'nav.profile',
    icon: 'UsersRound',
    displayOrder: 3,
    keywords: ['profile', 'account', 'self service', 'identity'],
    defaultPermissionCode: 'profile.view_self',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-access',
    name: 'Access Control',
    path: '/settings/access',
    titleKey: 'nav.systemAccess',
    icon: 'ShieldCheck',
    displayOrder: 4,
    keywords: ['access', 'permissions', 'overrides', 'rbac'],
    defaultPermissionCode: 'user.view',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-users',
    name: 'Users & Roles',
    path: '/settings/users',
    titleKey: 'nav.systemUsers',
    icon: 'UsersRound',
    displayOrder: 5,
    keywords: ['users', 'roles', 'permissions', 'access'],
    defaultPermissionCode: 'user.view',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-notifications',
    name: 'Notifications',
    path: '/settings/notifications',
    titleKey: 'nav.systemNotifications',
    icon: 'BellRing',
    displayOrder: 6,
    keywords: ['notifications', 'alerts', 'delivery', 'signals'],
    defaultPermissionCode: 'tenant.manage_settings',
  },
  {
    moduleCode: 'system_admin',
    code: 'settings-integrations',
    name: 'Integrations',
    path: '/settings/integrations',
    titleKey: 'nav.systemIntegrations',
    icon: 'PlugZap',
    displayOrder: 7,
    keywords: ['integrations', 'apis', 'connections', 'webhooks'],
    defaultPermissionCode: 'tenant.manage_settings',
  },
] as const

export const SCREEN_ACTION_DEFINITIONS: ReadonlyArray<ScreenActionDefinition> = [
  {
    screenCode: 'settings-users',
    code: 'user-invite',
    name: 'Invite User',
    actionKey: 'invite',
    description: 'Invite, resend, and revoke tenant invitations.',
    displayOrder: 0,
  },
  {
    screenCode: 'settings-users',
    code: 'user-update',
    name: 'Update User',
    actionKey: 'update',
    description: 'Update tenant user state and editable account fields.',
    displayOrder: 1,
  },
  {
    screenCode: 'settings-users',
    code: 'user-change-role',
    name: 'Change Role',
    actionKey: 'change_role',
    description: 'Assign or change a tenant user primary role.',
    displayOrder: 2,
  },
  {
    screenCode: 'settings-users',
    code: 'user-deactivate',
    name: 'Deactivate User',
    actionKey: 'deactivate',
    description: 'Suspend or disable tenant user access.',
    displayOrder: 3,
  },
  {
    screenCode: 'settings-access',
    code: 'permission-assign',
    name: 'Assign Permission',
    actionKey: 'assign_permission',
    description: 'Assign direct per-user permission overrides.',
    displayOrder: 0,
  },
] as const

// Every catalog permission maps to a module (and optionally a screen/action) plus a
// kind. Typed as a total Record so a missing/renamed permission code fails to
// compile — keeping this in lockstep with `PERMISSION_DEFINITIONS`.
export const PERMISSION_LINKS: Record<PermissionCode, PermissionLink> = {
  'tenant.view': { moduleCode: 'system_admin', screenCode: null, actionCode: null, kind: 'data' },
  'tenant.update': { moduleCode: 'system_admin', screenCode: null, actionCode: null, kind: 'admin' },
  'tenant.manage_settings': { moduleCode: 'system_admin', screenCode: 'settings-integrations', actionCode: null, kind: 'admin' },
  'user.view': { moduleCode: 'system_admin', screenCode: 'settings-users', actionCode: null, kind: 'screen' },
  'user.invite': { moduleCode: 'system_admin', screenCode: 'settings-users', actionCode: 'user-invite', kind: 'action' },
  'user.update': { moduleCode: 'system_admin', screenCode: 'settings-users', actionCode: 'user-update', kind: 'action' },
  'user.deactivate': { moduleCode: 'system_admin', screenCode: 'settings-users', actionCode: 'user-deactivate', kind: 'action' },
  'user.change_role': { moduleCode: 'system_admin', screenCode: 'settings-users', actionCode: 'user-change-role', kind: 'action' },
  'user.assign_permission': { moduleCode: 'system_admin', screenCode: 'settings-access', actionCode: 'permission-assign', kind: 'action' },
  'profile.view_self': { moduleCode: 'system_admin', screenCode: 'settings-profile', actionCode: null, kind: 'screen' },
  'profile.update_self': { moduleCode: 'system_admin', screenCode: 'settings-profile', actionCode: null, kind: 'action' },
  'dashboard.view': { moduleCode: 'overview', screenCode: 'dashboard', actionCode: null, kind: 'screen' },
  'role.view': { moduleCode: 'system_admin', screenCode: 'settings-roles', actionCode: null, kind: 'screen' },
  'role.manage': { moduleCode: 'system_admin', screenCode: 'settings-roles', actionCode: null, kind: 'admin' },
  'module.manage': { moduleCode: 'system_admin', screenCode: 'settings-modules', actionCode: null, kind: 'admin' },
  'res.dashboard.view': { moduleCode: 'restaurant', screenCode: null, actionCode: null, kind: 'screen' },
  'res.orders.view': { moduleCode: 'restaurant', screenCode: null, actionCode: null, kind: 'screen' },
  'res.orders.create': { moduleCode: 'restaurant', screenCode: null, actionCode: null, kind: 'action' },
  'res.orders.update': { moduleCode: 'restaurant', screenCode: null, actionCode: null, kind: 'action' },
  'res.orders.cancel': { moduleCode: 'restaurant', screenCode: null, actionCode: null, kind: 'action' },
  'res.cashier.access': { moduleCode: 'restaurant', screenCode: null, actionCode: null, kind: 'screen' },
  'res.kitchen.access': { moduleCode: 'restaurant', screenCode: 'restaurant-kitchen', actionCode: null, kind: 'screen' },
  'res.kitchen.update_order_status': { moduleCode: 'restaurant', screenCode: 'restaurant-kitchen', actionCode: null, kind: 'action' },
  'res.floor.manage': { moduleCode: 'restaurant', screenCode: 'restaurant-tables', actionCode: null, kind: 'action' },
  'res.users.view': { moduleCode: 'system_admin', screenCode: null, actionCode: null, kind: 'screen' },
  'res.users.manage': { moduleCode: 'system_admin', screenCode: null, actionCode: null, kind: 'action' },
  'res.settings.manage': { moduleCode: 'system_admin', screenCode: null, actionCode: null, kind: 'admin' },
}
