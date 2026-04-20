import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  requestSignInOtpMock: vi.fn(),
  verifySignInOtpMock: vi.fn(),
  sessionState: {} as Record<string, unknown>,
}))

vi.mock('@tanstack/react-router', async () => {
  const React = await import('react')

  return {
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode
      to: string
    }) => React.createElement('a', { href: to, ...props }, children),
    useNavigate: () => mocks.navigateMock,
  }
})

vi.mock('#/features/auth/browser-auth', () => ({
  requestSignInOtp: mocks.requestSignInOtpMock,
  verifySignInOtp: mocks.verifySignInOtpMock,
}))

vi.mock('#/features/auth/use-session-bootstrap', () => ({
  useSessionBootstrap: () => mocks.sessionState,
}))

let SignInPage: ComponentType

function createSessionState() {
  return {
    activeMembership: null,
    activeTenantId: null,
    clearSessionState: vi.fn(),
    completionFlow: null,
    context: null,
    data: undefined,
    error: null,
    isAuthenticated: false,
    isError: false,
    isPending: false,
    isRefetching: false,
    isSuccess: true,
    memberships: [],
    needsAccountCompletion: false,
    needsProfileCompletion: false,
    needsTenantSelection: false,
    refetch: vi.fn().mockResolvedValue({
      data: undefined,
    }),
    setActiveTenantId: vi.fn(),
    user: null,
  }
}

describe('SignInPage', () => {
  beforeEach(async () => {
    vi.resetModules()
    mocks.navigateMock.mockReset()
    mocks.requestSignInOtpMock.mockReset()
    mocks.verifySignInOtpMock.mockReset()
    mocks.requestSignInOtpMock.mockResolvedValue({
      data: {},
      error: null,
    })
    mocks.verifySignInOtpMock.mockResolvedValue({
      data: {},
      error: null,
    })
    Object.assign(mocks.sessionState, createSessionState())
    ;({ SignInPage } = await import('#/features/auth/sign-in-page'))
  })

  afterEach(() => {
    cleanup()
  })

  it('requests a sign-in code and moves to the verification step', async () => {
    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'OWNER@Example.COM' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in code/i }))

    await waitFor(() => {
      expect(mocks.requestSignInOtpMock).toHaveBeenCalledWith('owner@example.com')
    })

    expect(screen.getByText(/enter the 6-digit code sent to owner@example.com/i)).toBeTruthy()
    expect(screen.getByLabelText(/8-digit code/i)).toBeTruthy()
  })

  it('verifies the OTP and navigates into the dashboard flow', async () => {
    Object.assign(mocks.sessionState, {
      ...createSessionState(),
      refetch: vi.fn().mockResolvedValue({
        data: {
          authenticated: true,
          user: {
            profileCompleted: true,
            onboardingCompleted: true,
          },
          activeMembership: {
            status: 'active',
          },
          memberships: [{ tenantId: 'tenant-1' }],
          activeTenantId: 'tenant-1',
        },
      }),
    })

    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in code/i }))

    await screen.findByLabelText(/8-digit code/i)

    fireEvent.change(screen.getByLabelText(/8-digit code/i), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() => {
      expect(mocks.verifySignInOtpMock).toHaveBeenCalledWith(
        'owner@example.com',
        '12345678'
      )
    })

    expect(mocks.navigateMock).toHaveBeenCalledWith({ to: '/dashboard' })
  })

  it('can resend the code from the verification step', async () => {
    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in code/i }))

    await screen.findByLabelText(/8-digit code/i)

    fireEvent.click(screen.getByRole('button', { name: /send another code/i }))

    await waitFor(() => {
      expect(mocks.requestSignInOtpMock).toHaveBeenCalledTimes(2)
    })
  })

  it('renders Supabase verification errors', async () => {
    mocks.verifySignInOtpMock.mockResolvedValue({
      data: {},
      error: {
        message: 'Invalid or expired code.',
      },
    })

    render(<SignInPage />)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in code/i }))

    await screen.findByLabelText(/8-digit code/i)

    fireEvent.change(screen.getByLabelText(/8-digit code/i), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired code.')).toBeTruthy()
    })
  })
})
