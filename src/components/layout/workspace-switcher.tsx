"use client"

import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { ChevronDown, Crown, Store } from 'lucide-react'

export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const { memberships, activeMembership, setActiveTenantId } = useSessionBootstrap()

  if (!activeMembership) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-auto w-full justify-between rounded-[1.1rem] border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-start text-sidebar-foreground shadow-none hover:bg-white/[0.07]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary/[0.16] text-sidebar-primary">
              <Store />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {activeMembership.tenantName}
              </span>
              <span className="block truncate text-xs text-sidebar-foreground/65">
                {activeMembership.roleLabel}
              </span>
            </span>
          </span>
          <ChevronDown className="text-sidebar-foreground/55" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          {memberships.map((membership) => (
            <DropdownMenuItem
              key={membership.tenantId}
              onSelect={() => setActiveTenantId(membership.tenantId)}
              className="items-start gap-3 py-3"
            >
              <span className="mt-0.5 flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Crown />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">
                  {membership.tenantName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {membership.status === 'active' ? 'Active workspace access' : 'Pending workspace access'}
                </span>
              </span>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary" className="capitalize">
                  {membership.roleLabel}
                </Badge>
                {membership.tenantId === activeMembership.tenantId ? (
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
                    {t('command.current')}
                  </span>
                ) : null}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
