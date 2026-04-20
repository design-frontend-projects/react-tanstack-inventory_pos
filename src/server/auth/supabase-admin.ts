import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '#/lib/env/server'
import { ValidationError } from '#/server/auth/errors'

export function createAdminSupabaseClient(): SupabaseClient {
  if (!serverEnv.VITE_SUPABASE_SECRET_KEY) {
    throw new ValidationError('VITE_SUPABASE_SECRET_KEY is required for admin auth flows.')
  }

  return createClient(
    serverEnv.VITE_SUPABASE_URL,
    serverEnv.VITE_SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
