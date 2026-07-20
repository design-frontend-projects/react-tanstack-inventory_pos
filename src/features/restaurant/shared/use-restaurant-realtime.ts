'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '#/lib/supabase/client'
import { usePreferencesStore } from '#/features/preferences/preferences-store'

// Realtime push for the restaurant screens. The server broadcasts tenant-scoped
// invalidation signals (see src/server/realtime/broadcast.ts) after every
// restaurant mutation; this hook subscribes to the tenant channel and
// invalidates the matching query caches so data refetches through the guarded
// server functions. Mount it once per workspace screen.

const SCOPE_QUERY_PREFIXES: Record<string, Array<string>> = {
  floor: [
    'res-floor-status',
    'res-dining-areas',
    'res-table-sections',
    'res-tables',
    'res-floor-assignments',
  ],
  orders: ['res-orders', 'res-order', 'res-floor-status'],
  kitchen: ['res-kitchen-board', 'res-orders', 'res-order'],
  menu: ['res-menus', 'res-menu-categories', 'res-menu-items'],
  reservations: ['res-reservations', 'res-waitlist'],
  takeaway: ['res-takeaway-board'],
  delivery: ['res-deliveries', 'res-drivers', 'res-delivery-zones'],
  events: ['res-events', 'res-catering-jobs'],
}

export function useRestaurantRealtime() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (!tenantId) {
      return
    }

    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`restaurant:${tenantId}`)
      .on('broadcast', { event: 'invalidate' }, (message) => {
        const scope = (message.payload as { scope?: string } | undefined)?.scope
        const prefixes = scope ? (SCOPE_QUERY_PREFIXES[scope] ?? []) : []

        for (const prefix of prefixes) {
          void queryClient.invalidateQueries({ queryKey: [prefix, tenantId] })
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])
}
