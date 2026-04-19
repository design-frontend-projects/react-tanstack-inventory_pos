import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

describe('supabase server client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    createClientMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates a fresh non-persisting server client for each call', async () => {
    const firstServerClient = { runtime: 'server-1' }
    const secondServerClient = { runtime: 'server-2' }

    createClientMock
      .mockReturnValueOnce(firstServerClient)
      .mockReturnValueOnce(secondServerClient)

    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/test')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const { createServerSupabaseClient } = await import(
      '#/server/auth/supabase-server'
    )

    expect(createServerSupabaseClient()).toBe(firstServerClient)
    expect(createServerSupabaseClient()).toBe(secondServerClient)
    expect(createClientMock).toHaveBeenCalledTimes(2)
    expect(createClientMock).toHaveBeenNthCalledWith(
      1,
      'https://example.supabase.co',
      'anon-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    )
  })
})
