import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '#/lib/env/server'
import { ValidationError } from '#/server/auth/errors'

export function createAdminSupabaseClient(): SupabaseClient {
  const serviceRoleKey =
    serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? serverEnv.VITE_SUPABASE_SECRET_KEY

  if (!serviceRoleKey) {
    throw new ValidationError(
      'SUPABASE_SERVICE_ROLE_KEY is required for admin auth flows.'
    )
  }

  return createClient(
    serverEnv.VITE_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
