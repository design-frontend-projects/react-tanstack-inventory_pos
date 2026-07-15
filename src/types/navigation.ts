// DB-driven navigation tree: modules -> menu screens, already filtered by the
// current user's effective permissions and the tenant's enabled modules. Powers
// the sidebar (and, later, breadcrumbs / command palette).

export type NavScreen = {
  id: string
  code: string
  name: string
  path: string
  titleKey: string | null
  icon: string | null
}

export type NavModule = {
  id: string
  code: string
  name: string
  titleKey: string | null
  icon: string | null
  rootPath: string
  screens: Array<NavScreen>
}

export type NavigationTree = {
  modules: Array<NavModule>
}
