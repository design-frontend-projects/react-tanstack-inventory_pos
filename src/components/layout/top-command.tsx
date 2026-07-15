"use client"

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { SearchIcon, Store } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '#/components/ui/command'
import { cn } from '#/lib/utils'
import {
  appNavSections,
  dashboardNavItem,
  isAppPathActive,
} from '#/lib/navigation/app-nav'
import type {
  AppCommandEntry,
  AppNavRouteTo,
} from '#/lib/navigation/app-nav'
import type { NavSectionView } from '#/features/layout/navigation-view'
import { navTreeToSections } from '#/features/layout/navigation-view'
import type { WorkspaceMembership } from '#/types/app'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { useNavigationTree } from '#/features/layout/use-navigation-tree'
import { hasAnyPermission } from '#/features/auth/permissions'

const DESKTOP_SHORTCUT = 'Ctrl K'

function buildCommandSearchValue(entry: AppCommandEntry) {
  return [
    entry.title,
    entry.description,
    ...entry.keywords,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function TopCommand({
  pathname,
  memberships,
  activeTenantId,
  onNavigate,
  onSelectWorkspace,
  className,
}: {
  pathname: string
  memberships: WorkspaceMembership[]
  activeTenantId: string
  onNavigate: (to: AppNavRouteTo) => void
  onSelectWorkspace: (tenantId: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const { context } = useSessionBootstrap()
  const navQuery = useNavigationTree(activeTenantId || null)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const entries = React.useMemo(() => {
    const label = (fallbackTitle: string, titleKey?: string) =>
      titleKey ? t(titleKey, fallbackTitle) : fallbackTitle

    // Prefer the DB-driven navigation tree (already permission-filtered
    // server-side); fall back to the static catalog while it loads or on error.
    const dbSections = navTreeToSections(navQuery.data)
    const staticSections: Array<NavSectionView> = appNavSections
      .filter(
        (section) =>
          !section.permissions?.length ||
          hasAnyPermission(context?.permissions ?? [], section.permissions)
      )
      .map((section) => ({
        id: section.id,
        icon: section.icon,
        titleKey: section.titleKey,
        fallbackTitle: section.fallbackTitle,
        rootTo: section.rootTo,
        keywords: section.keywords,
        items: section.items
          .filter(
            (item) =>
              !item.permissions?.length ||
              hasAnyPermission(context?.permissions ?? [], item.permissions)
          )
          .map((item) => ({
            id: item.id,
            to: item.to,
            icon: item.icon,
            titleKey: item.titleKey,
            fallbackTitle: item.fallbackTitle,
            keywords: item.keywords,
          })),
      }))
      .filter((section) => section.items.length > 0)

    const sections = dbSections.length > 0 ? dbSections : staticSections

    const navigationEntries: AppCommandEntry[] = [
      {
        id: 'nav-dashboard',
        group: 'navigation',
        icon: dashboardNavItem.icon,
        title: t(dashboardNavItem.titleKey, dashboardNavItem.fallbackTitle),
        keywords: dashboardNavItem.keywords,
        to: dashboardNavItem.to,
        current: isAppPathActive(pathname, dashboardNavItem.to),
      },
      ...sections.map((section) => ({
        id: `nav-${section.id}`,
        group: 'navigation' as const,
        icon: section.icon,
        title: label(section.fallbackTitle, section.titleKey),
        keywords: section.keywords,
        to: section.rootTo,
        current:
          pathname === section.rootTo ||
          section.items.some((item) => isAppPathActive(pathname, item.to)),
      })),
    ]

    const pageEntries: AppCommandEntry[] = sections.flatMap((section) =>
      section.items.map((item) => ({
        id: `page-${item.id}`,
        group: 'pages' as const,
        icon: item.icon,
        title: label(item.fallbackTitle, item.titleKey),
        description: label(section.fallbackTitle, section.titleKey),
        keywords: item.keywords,
        to: item.to,
        current: isAppPathActive(pathname, item.to),
      }))
    )

    const workspaceEntries: AppCommandEntry[] = memberships.map((membership) => ({
      id: `workspace-${membership.tenantId}`,
      group: 'workspaces' as const,
      icon: Store,
      title: membership.tenantName,
      description: membership.status === 'active' ? membership.roleLabel : 'Pending access',
      keywords: [
        membership.tenantName,
        membership.roleCode,
        membership.roleLabel,
        membership.status,
      ],
      tenantId: membership.tenantId,
      current: membership.tenantId === activeTenantId,
    }))

    return {
      navigationEntries,
      pageEntries,
      workspaceEntries,
    }
  }, [activeTenantId, context?.permissions, memberships, navQuery.data, pathname, t])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-label={t('header.searchLabel')}
        className={cn(
          'h-11 w-full justify-between rounded-[1rem] border-border/70 bg-background/85 px-3 text-muted-foreground shadow-none hover:bg-background',
          className
        )}
        onClick={() => setOpen(true)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <SearchIcon data-icon="inline-start" />
          <span className="truncate text-sm">{t('header.searchPlaceholder')}</span>
        </span>
        <span className="hidden rounded-md border border-border/70 bg-muted/70 px-2 py-1 text-[0.68rem] font-semibold tracking-[0.16em] text-muted-foreground md:inline">
          {DESKTOP_SHORTCUT}
        </span>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('command.dialogTitle')}
        description={t('command.dialogDescription')}
        className="max-w-2xl"
      >
        <Command className="rounded-[1.35rem]! bg-background">
          <CommandInput placeholder={t('command.searchPlaceholder')} />
          <CommandList className="max-h-[min(70vh,32rem)]">
            <CommandEmpty>{t('command.noResults')}</CommandEmpty>

            <CommandGroup heading={t('command.groups.navigation')}>
              {entries.navigationEntries.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={buildCommandSearchValue(entry)}
                  data-checked={entry.current ? 'true' : undefined}
                  className="gap-3 py-2"
                  onSelect={() => {
                    if (!entry.to) {
                      return
                    }

                    onNavigate(entry.to)
                    setOpen(false)
                  }}
                >
                  <entry.icon />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{entry.title}</span>
                  </div>
                  {entry.current ? (
                    <CommandShortcut>{t('command.current')}</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t('command.groups.pages')}>
              {entries.pageEntries.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={buildCommandSearchValue(entry)}
                  data-checked={entry.current ? 'true' : undefined}
                  className="gap-3 py-2"
                  onSelect={() => {
                    if (!entry.to) {
                      return
                    }

                    onNavigate(entry.to)
                    setOpen(false)
                  }}
                >
                  <entry.icon />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{entry.title}</span>
                    {entry.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.description}
                      </span>
                    ) : null}
                  </div>
                  {entry.current ? (
                    <CommandShortcut>{t('command.current')}</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading={t('command.groups.workspaces')}>
              {entries.workspaceEntries.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={buildCommandSearchValue(entry)}
                  data-checked={entry.current ? 'true' : undefined}
                  className="gap-3 py-2"
                  onSelect={() => {
                    if (!entry.tenantId) {
                      return
                    }

                    onSelectWorkspace(entry.tenantId)
                    setOpen(false)
                  }}
                >
                  <entry.icon />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{entry.title}</span>
                    {entry.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {entry.description}
                      </span>
                    ) : null}
                  </div>
                  {entry.current ? (
                    <CommandShortcut>{t('command.current')}</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
