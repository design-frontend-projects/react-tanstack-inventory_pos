import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

describe('supabase browser client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    createClientMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates the browser client once and reuses the cached instance', async () => {
    const browserClient = { runtime: 'browser' }

    createClientMock.mockReturnValue(browserClient)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const { getSupabaseBrowserClient } = await import('#/lib/supabase/client')

    expect(getSupabaseBrowserClient()).toBe(browserClient)
    expect(getSupabaseBrowserClient()).toBe(browserClient)
    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key'
    )
  })

  it('throws an explicit error when the Supabase URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    await expect(import('#/lib/supabase/client')).rejects.toThrow(
      /VITE_SUPABASE_URL is required/
    )
  })

  it('throws an explicit error when the Supabase anon key is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    await expect(import('#/lib/supabase/client')).rejects.toThrow(
      /VITE_SUPABASE_ANON_KEY is required/
    )
  })
})
