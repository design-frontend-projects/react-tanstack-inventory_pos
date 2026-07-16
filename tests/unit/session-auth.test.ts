import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceUnavailableError, UnauthorizedError } from '#/server/auth/errors'
import { getAuthenticatedSupabaseUser } from '#/server/auth/session'

const { getClaimsMock, createServerSupabaseClientMock } = vi.hoisted(() => {
  const getClaims = vi.fn()
  return {
    getClaimsMock: getClaims,
    createServerSupabaseClientMock: vi.fn(() => ({
      auth: { getClaims },
    })),
  }
})

vi.mock('#/server/auth/supabase-server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

// A structurally valid (three-segment) compact JWT. Content is irrelevant —
// verification is fully mocked via getClaims.
const VALID_SHAPE_TOKEN = 'header.payload.signature'

describe('getAuthenticatedSupabaseUser', () => {
  beforeEach(() => {
    getClaimsMock.mockReset()
    createServerSupabaseClientMock.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an empty or whitespace token before any network call', async () => {
    await expect(getAuthenticatedSupabaseUser('   ')).rejects.toBeInstanceOf(
      UnauthorizedError
    )
    expect(getClaimsMock).not.toHaveBeenCalled()
  })

  it('rejects a structurally malformed token before any network call', async () => {
    await expect(
      getAuthenticatedSupabaseUser('not-a-jwt')
    ).rejects.toBeInstanceOf(UnauthorizedError)
    expect(getClaimsMock).not.toHaveBeenCalled()
  })

  it('maps verified claims to the authenticated user shape', async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: {
          sub: 'auth-user-1',
          email: 'owner@example.com',
          phone: '+15551234',
          is_anonymous: false,
          user_metadata: { first_name: 'Ada' },
        },
      },
      error: null,
    })
    const user = await getAuthenticatedSupabaseUser(VALID_SHAPE_TOKEN)

    expect(getClaimsMock).toHaveBeenCalledWith(VALID_SHAPE_TOKEN)
    expect(user).toEqual({
      id: 'auth-user-1',
      email: 'owner@example.com',
      phone: '+15551234',
      isAnonymous: false,
      user_metadata: { first_name: 'Ada' },
    })
  })

  it('defaults optional claim fields safely', async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: 'auth-user-2' } },
      error: null,
    })
    const user = await getAuthenticatedSupabaseUser(VALID_SHAPE_TOKEN)

    expect(user).toEqual({
      id: 'auth-user-2',
      email: null,
      phone: null,
      isAnonymous: false,
      user_metadata: {},
    })
  })

  it('treats an invalid/expired token (4xx) as unauthorized', async () => {
    getClaimsMock.mockResolvedValue({
      data: null,
      error: { name: 'AuthApiError', message: 'invalid JWT', status: 401 },
    })

    await expect(
      getAuthenticatedSupabaseUser(VALID_SHAPE_TOKEN)
    ).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('treats an upstream 5xx as a service outage, not an auth failure', async () => {
    getClaimsMock.mockResolvedValue({
      data: null,
      error: { name: 'AuthApiError', message: 'upstream', status: 503 },
    })

    await expect(
      getAuthenticatedSupabaseUser(VALID_SHAPE_TOKEN)
    ).rejects.toBeInstanceOf(ServiceUnavailableError)
  })

  it('treats a thrown transport error as a service outage', async () => {
    getClaimsMock.mockRejectedValue(new Error('fetch failed'))

    await expect(
      getAuthenticatedSupabaseUser(VALID_SHAPE_TOKEN)
    ).rejects.toBeInstanceOf(ServiceUnavailableError)
  })

  it('preserves the underlying error as cause for observability', async () => {
    const underlying = { name: 'AuthApiError', message: 'bad', status: 403 }
    getClaimsMock.mockResolvedValue({ data: null, error: underlying })

    await expect(
      getAuthenticatedSupabaseUser(VALID_SHAPE_TOKEN)
    ).rejects.toMatchObject({ cause: underlying })
  })
})
