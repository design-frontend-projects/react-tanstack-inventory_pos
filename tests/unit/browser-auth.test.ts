import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signInWithOtpMock, verifyOtpMock } = vi.hoisted(() => ({
  signInWithOtpMock: vi.fn(),
  verifyOtpMock: vi.fn(),
}))

vi.mock('#/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithOtp: signInWithOtpMock,
      signOut: vi.fn(),
      verifyOtp: verifyOtpMock,
    },
  }),
}))

describe('browser auth helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    signInWithOtpMock.mockReset()
    verifyOtpMock.mockReset()
    signInWithOtpMock.mockResolvedValue({
      data: {},
      error: null,
    })
    verifyOtpMock.mockResolvedValue({
      data: {},
      error: null,
    })
  })

  it('requests a sign-in OTP without creating new users', async () => {
    const { requestSignInOtp } = await import('#/features/auth/browser-auth')

    await requestSignInOtp('owner@example.com')

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      options: {
        shouldCreateUser: false,
        data: {
          auth_flow: 'sign_in',
          auth_delivery: 'otp',
        },
      },
    })
  })

  it('verifies the emailed OTP using the email token type', async () => {
    const { verifySignInOtp } = await import('#/features/auth/browser-auth')

    await verifySignInOtp('owner@example.com', '123456')

    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: 'owner@example.com',
      token: '123456',
      type: 'email',
    })
  })
})
