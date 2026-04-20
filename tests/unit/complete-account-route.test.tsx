import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'

const mocks = vi.hoisted(() => ({
  acceptInvitationServerFnMock: vi.fn(),
  completeOwnerOnboardingServerFnMock: vi.fn(),
  getAccessTokenMock: vi.fn(),
  navigateMock: vi.fn(),
  sessionState: {} as Record<string, unknown>,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigateMock,
}))

vi.mock('#/features/auth/browser-auth', () => ({
  getAccessToken: mocks.getAccessTokenMock,
}))

vi.mock('#/features/auth/server-functions', () => ({
  acceptInvitationServerFn: mocks.acceptInvitationServerFnMock,
  completeOwnerOnboardingServerFn: mocks.completeOwnerOnboardingServerFnMock,
}))

vi.mock('#/features/auth/use-session-bootstrap', () => ({
  useSessionBootstrap: () => mocks.sessionState,
}))

let CompleteAccountPage: ComponentType

function createSessionState() {
  return {
    activeMembership: null,
    activeTenantId: null,
    clearSessionState: vi.fn(),
    completionFlow: null,
    context: null,
    data: undefined,
    error: null,
    isAuthenticated: true,
    isError: false,
    isPending: false,
    isRefetching: false,
    isSuccess: true,
    memberships: [],
    needsAccountCompletion: false,
    needsProfileCompletion: false,
    needsTenantSelection: false,
    refetch: vi.fn(),
    setActiveTenantId: vi.fn(),
    user: {
      email: 'owner@example.com',
      firstName: 'Nadia',
      lastName: 'Hassan',
      phone: '+20 100 000 0000',
      avatarUrl: '',
    },
  }
}

describe('CompleteAccountPage', () => {
  beforeEach(async () => {
    vi.resetModules()
    mocks.navigateMock.mockReset()
    mocks.getAccessTokenMock.mockReset()
    mocks.acceptInvitationServerFnMock.mockReset()
    mocks.completeOwnerOnboardingServerFnMock.mockReset()
    mocks.getAccessTokenMock.mockResolvedValue('access-token')
    Object.assign(mocks.sessionState, createSessionState())
    window.history.pushState({}, '', '/complete-account')
    ;({ CompleteAccountPage } = await import('#/features/auth/complete-account-page'))
  })

  afterEach(() => {
    cleanup()
  })

  it('submits the owner onboarding flow from the emailed link context', async () => {
    mocks.completeOwnerOnboardingServerFnMock.mockResolvedValue({
      tenantId: 'tenant-1',
    })
    window.history.pushState(
      {},
      '',
      '/complete-account?flow=owner&registrationId=550e8400-e29b-41d4-a716-446655440000'
    )

    render(<CompleteAccountPage />)

    fireEvent.change(screen.getByPlaceholderText('First name'), {
      target: { value: 'Nadia' },
    })
    fireEvent.change(screen.getByPlaceholderText('Last name'), {
      target: { value: 'Hassan' },
    })
    fireEvent.change(screen.getByPlaceholderText('Tenant name'), {
      target: { value: 'Meridian Foods' },
    })
    fireEvent.change(screen.getByPlaceholderText('Timezone'), {
      target: { value: 'Africa/Cairo' },
    })
    fireEvent.change(screen.getByPlaceholderText('Create password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create tenant workspace/i }))

    await waitFor(() => {
      expect(mocks.completeOwnerOnboardingServerFnMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accessToken: 'access-token',
          registrationId: '550e8400-e29b-41d4-a716-446655440000',
          tenantName: 'Meridian Foods',
          timezone: 'Africa/Cairo',
        }),
      })
    })

    expect(mocks.sessionState.setActiveTenantId).toHaveBeenCalledWith('tenant-1')
    expect(mocks.navigateMock).toHaveBeenCalledWith({ to: '/dashboard' })
  })

  it('submits the invitation acceptance flow from the emailed link context', async () => {
    mocks.acceptInvitationServerFnMock.mockResolvedValue({
      tenantId: 'tenant-2',
    })
    window.history.pushState(
      {},
      '',
      '/complete-account?flow=invite&invitationId=550e8400-e29b-41d4-a716-446655440001'
    )

    render(<CompleteAccountPage />)

    fireEvent.change(screen.getByPlaceholderText('First name'), {
      target: { value: 'Nadia' },
    })
    fireEvent.change(screen.getByPlaceholderText('Last name'), {
      target: { value: 'Hassan' },
    })
    fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }))

    await waitFor(() => {
      expect(mocks.acceptInvitationServerFnMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accessToken: 'access-token',
          invitationId: '550e8400-e29b-41d4-a716-446655440001',
          firstName: 'Nadia',
          lastName: 'Hassan',
        }),
      })
    })

    expect(mocks.sessionState.setActiveTenantId).toHaveBeenCalledWith('tenant-2')
    expect(mocks.navigateMock).toHaveBeenCalledWith({ to: '/dashboard' })
  })

  it('redirects authenticated users with an active tenant to the dashboard', async () => {
    Object.assign(mocks.sessionState, {
      ...createSessionState(),
      activeTenantId: 'tenant-1',
    })

    render(<CompleteAccountPage />)

    await waitFor(() => {
      expect(mocks.navigateMock).toHaveBeenCalledWith({ to: '/dashboard' })
    })
  })

  it('redirects authenticated users to tenant selection when no active tenant is resolved', async () => {
    Object.assign(mocks.sessionState, {
      ...createSessionState(),
      memberships: [{ tenantId: 'tenant-1' }, { tenantId: 'tenant-2' }],
      needsTenantSelection: true,
    })

    render(<CompleteAccountPage />)

    await waitFor(() => {
      expect(mocks.navigateMock).toHaveBeenCalledWith({ to: '/select-tenant' })
    })
  })

  it('shows the fallback state when the authenticated user has no completion flow or memberships', () => {
    render(<CompleteAccountPage />)

    expect(screen.getByText(/no account completion context is attached to this session/i)).toBeTruthy()
    expect(mocks.navigateMock).not.toHaveBeenCalled()
  })
})
