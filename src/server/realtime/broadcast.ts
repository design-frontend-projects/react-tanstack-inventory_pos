import { serverEnv } from '#/lib/env/server'

// Server-side Supabase Realtime broadcast. We push tenant-scoped *invalidation
// signals* (never row data) after restaurant mutations; browsers subscribed to
// the tenant channel invalidate the matching TanStack Query caches and refetch
// through the guarded server functions. This keeps the security boundary in the
// server fns while giving every connected screen sub-second updates.

export type RestaurantRealtimeScope =
  | 'floor'
  | 'orders'
  | 'kitchen'
  | 'menu'
  | 'reservations'
  | 'takeaway'
  | 'delivery'
  | 'events'

export function restaurantChannelTopic(tenantId: string): string {
  return `restaurant:${tenantId}`
}

// Fire-and-forget: a broadcast failure must never fail the mutation that
// triggered it. Missing service credentials simply disable push (clients still
// refetch after their own mutations).
export function broadcastRestaurantEvent(
  tenantId: string,
  scopes: ReadonlyArray<RestaurantRealtimeScope>
): void {
  const serviceKey =
    serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? serverEnv.VITE_SUPABASE_SECRET_KEY

  if (!serviceKey || scopes.length === 0) {
    return
  }

  void fetch(`${serverEnv.VITE_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: scopes.map((scope) => ({
        topic: restaurantChannelTopic(tenantId),
        event: 'invalidate',
        payload: { scope },
      })),
    }),
  }).catch(() => {
    // Intentionally swallowed — push is best-effort.
  })
}
