import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '#/lib/env/server'

export function createServerSupabaseClient(): SupabaseClient {
  return createClient(
    serverEnv.VITE_SUPABASE_URL,
    serverEnv.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
