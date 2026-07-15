import type { LucideIcon } from 'lucide-react'
import type { NavigationTree } from '#/types/navigation'
import type { AppNavRouteTo } from '#/lib/navigation/app-nav'
import { isAppPathActive } from '#/lib/navigation/app-nav'
import { resolveNavIcon } from '#/lib/navigation/icon-map'

// Shared view models that let the sidebar, command palette, and breadcrumbs render
// from the DB-driven navigation tree with a consistent shape.

export type NavItemView = {
  id: string
  to: AppNavRouteTo
  icon: LucideIcon
  titleKey?: string
  fallbackTitle: string
  keywords: Array<string>
}

export type NavSectionView = {
  id: string
  icon: LucideIcon
  titleKey?: string
  fallbackTitle: string
  rootTo: AppNavRouteTo
  keywords: Array<string>
  items: Array<NavItemView>
}

// The 'overview' module holds the standalone dashboard entry, rendered on its own.
export function navTreeToSections(
  tree: NavigationTree | undefined
): Array<NavSectionView> {
  if (!tree) {
    return []
  }

  return tree.modules
    .filter((module) => module.code !== 'overview')
    .map((module) => ({
      id: module.code,
      icon: resolveNavIcon(module.icon),
      titleKey: module.titleKey ?? undefined,
      fallbackTitle: module.name,
      rootTo: module.rootPath as AppNavRouteTo,
      keywords: [module.name, module.code],
      items: module.screens.map((screen) => ({
        id: screen.code,
        to: screen.path as AppNavRouteTo,
        icon: resolveNavIcon(screen.icon),
        titleKey: screen.titleKey ?? undefined,
        fallbackTitle: screen.name,
        keywords: [screen.name, screen.code],
      })),
    }))
}

export type ActiveNav = {
  screenTitleKey?: string
  screenFallback: string
  moduleTitleKey?: string
  // null when the active screen belongs to the 'overview' module (dashboard)
  moduleFallback: string | null
}

export function findActiveNavFromTree(
  tree: NavigationTree | undefined,
  pathname: string
): ActiveNav | null {
  if (!tree) {
    return null
  }

  const candidates = tree.modules
    .flatMap((module) => module.screens.map((screen) => ({ module, screen })))
    // longest path first so nested routes win over their parents
    .sort((left, right) => right.screen.path.length - left.screen.path.length)

  const match = candidates.find((candidate) =>
    isAppPathActive(pathname, candidate.screen.path as AppNavRouteTo)
  )

  if (!match) {
    return null
  }

  const isOverview = match.module.code === 'overview'

  return {
    screenTitleKey: match.screen.titleKey ?? undefined,
    screenFallback: match.screen.name,
    moduleTitleKey: isOverview ? undefined : (match.module.titleKey ?? undefined),
    moduleFallback: isOverview ? null : match.module.name,
  }
}
