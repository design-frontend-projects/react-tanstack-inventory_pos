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
  getAppNavSection,
  isAppPathActive,
} from '#/lib/navigation/app-nav'
import type {
  AppCommandEntry,
  AppNavRouteTo,
} from '#/lib/navigation/app-nav'
import type { WorkspaceMembership } from '#/types/app'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
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
    const visibleSections = appNavSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            !item.permissions?.length ||
            hasAnyPermission(context?.permissions ?? [], item.permissions)
        ),
      }))
      .filter(
        (section) =>
          section.items.length > 0 &&
          (!section.permissions?.length ||
            hasAnyPermission(context?.permissions ?? [], section.permissions))
      )

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
      ...visibleSections.map((section) => ({
        id: `nav-${section.id}`,
        group: 'navigation' as const,
        icon: section.icon,
        title: t(section.titleKey, section.fallbackTitle),
        keywords: section.keywords,
        to: section.rootTo,
        current:
          pathname === section.rootTo ||
          getAppNavSection(section.id)?.items.some((item) =>
            isAppPathActive(pathname, item.to)
          ) === true,
      })),
    ]

    const pageEntries: AppCommandEntry[] = visibleSections.flatMap((section) =>
      section.items.map((item) => ({
        id: `page-${item.id}`,
        group: 'pages' as const,
        icon: item.icon,
        title: t(item.titleKey, item.fallbackTitle),
        description: t(section.titleKey, section.fallbackTitle),
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
  }, [activeTenantId, context?.permissions, memberships, pathname, t])

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
