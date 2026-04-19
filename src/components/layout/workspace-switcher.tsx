"use client"

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
  const { memberships, activeMembership, setActiveTenantId } = useSessionBootstrap()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-auto w-full justify-between rounded-[1.3rem] border-white/[0.10] bg-white/[0.05] px-3 py-3 text-start text-sidebar-foreground hover:bg-white/[0.08]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary/[0.18] text-sidebar-primary">
              <Store />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {activeMembership.tenantName}
              </span>
              <span className="block truncate text-xs text-sidebar-foreground/65">
                {activeMembership.regionLabel}
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
                  {membership.regionLabel}
                </span>
              </span>
              <Badge variant="secondary" className="capitalize">
                {membership.role}
              </Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
