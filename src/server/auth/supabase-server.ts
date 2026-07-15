import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '#/lib/env/server'

export function createServerSupabaseClient(accessToken?: string): SupabaseClient {
  return createClient(
    serverEnv.VITE_SUPABASE_URL,
    serverEnv.VITE_SUPABASE_ANON_KEY,
    {
      global: accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        : undefined,
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
