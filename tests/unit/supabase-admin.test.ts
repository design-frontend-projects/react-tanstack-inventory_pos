import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

describe('supabase admin client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    createClientMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers SUPABASE_SERVICE_ROLE_KEY for admin auth flows', async () => {
    const adminClient = { runtime: 'admin' }

    createClientMock.mockReturnValue(adminClient)
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/test')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('VITE_SUPABASE_SECRET_KEY', 'legacy-secret-key')

    const { createAdminSupabaseClient } = await import('#/server/auth/supabase-admin')

    expect(createAdminSupabaseClient()).toBe(adminClient)
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    )
  })

  it('falls back to the legacy secret key when the service role key is absent', async () => {
    const adminClient = { runtime: 'legacy-admin' }

    createClientMock.mockReturnValue(adminClient)
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/test')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.stubEnv('VITE_SUPABASE_SECRET_KEY', 'legacy-secret-key')

    const { createAdminSupabaseClient } = await import('#/server/auth/supabase-admin')

    expect(createAdminSupabaseClient()).toBe(adminClient)
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'legacy-secret-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    )
  })

  it('throws a validation error when no admin key is configured', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/test')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.stubEnv('VITE_SUPABASE_SECRET_KEY', '')

    const { createAdminSupabaseClient } = await import('#/server/auth/supabase-admin')

    expect(() => createAdminSupabaseClient()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY is required/
    )
  })
})
