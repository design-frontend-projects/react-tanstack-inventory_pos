import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clientEnv } from '#/lib/env/client'

let browserSupabaseClient: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserSupabaseClient) {
    return browserSupabaseClient
  }

  browserSupabaseClient = createClient(
    clientEnv.VITE_SUPABASE_URL,
    clientEnv.VITE_SUPABASE_ANON_KEY,
  )

  return browserSupabaseClient
}
