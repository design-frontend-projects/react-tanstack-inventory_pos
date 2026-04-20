import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { TopCommand } from '#/components/layout/top-command'
import i18n from '#/lib/i18n'
import type { AppNavRouteTo } from '#/lib/navigation/app-nav'
import type { WorkspaceMembership } from '#/types/app'

vi.mock('#/features/auth/use-session-bootstrap', () => ({
  useSessionBootstrap: () => ({
    context: {
      permissions: [
        'tenant.view',
        'dashboard.view',
        'res.dashboard.view',
        'res.kitchen.access',
        'tenant.manage_settings',
        'user.view',
      ],
    },
  }),
}))

const memberships: WorkspaceMembership[] = [
  {
    tenantId: 'meridian-foods',
    tenantName: 'Meridian Foods Group',
    roleCode: 'super_admin',
    roleLabel: 'Super Admin',
    isOwner: true,
    status: 'active',
    joinedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    tenantId: 'night-shift-labs',
    tenantName: 'Night Shift Labs',
    roleCode: 'admin',
    roleLabel: 'Admin',
    isOwner: false,
    status: 'active',
    joinedAt: '2026-04-02T00:00:00.000Z',
  },
]

function renderTopCommand({
  pathname = '/dashboard',
  activeTenantId = 'meridian-foods',
  onNavigate = vi.fn(),
  onSelectWorkspace = vi.fn(),
}: {
  pathname?: string
  activeTenantId?: string
  onNavigate?: (to: AppNavRouteTo) => void
  onSelectWorkspace?: (tenantId: string) => void
} = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <TopCommand
        pathname={pathname}
        memberships={memberships}
        activeTenantId={activeTenantId}
        onNavigate={onNavigate}
        onSelectWorkspace={onSelectWorkspace}
      />
    </I18nextProvider>
  )

  return { onNavigate, onSelectWorkspace }
}

describe('TopCommand', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    cleanup()
  })

  it('opens the command dialog from the visible search trigger', () => {
    renderTopCommand()

    fireEvent.click(
      screen.getByRole('button', { name: /open command surface/i })
    )

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(
      screen.getByPlaceholderText(/type a route, page, or workspace/i)
    ).toBeTruthy()
  })

  it('opens from both ctrl+k and cmd+k', () => {
    const firstRender = renderTopCommand()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByRole('dialog')).toBeTruthy()

    cleanup()

    renderTopCommand({
      onNavigate: firstRender.onNavigate,
      onSelectWorkspace: firstRender.onSelectWorkspace,
    })

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('filters results from the navigation manifest', async () => {
    renderTopCommand()

    fireEvent.click(
      screen.getByRole('button', { name: /open command surface/i })
    )
    fireEvent.change(
      screen.getByPlaceholderText(/type a route, page, or workspace/i),
      { target: { value: 'kitchen' } }
    )

    expect(screen.getByText('Kitchen Board')).toBeTruthy()

    await waitFor(() => {
      expect(screen.queryByText('Users & Roles')).toBeNull()
    })
  })

  it('navigates to a route when a route result is selected', () => {
    const onNavigate = vi.fn()

    renderTopCommand({ onNavigate })

    fireEvent.click(
      screen.getByRole('button', { name: /open command surface/i })
    )
    fireEvent.click(screen.getByText('Dashboard'))

    expect(onNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('switches workspaces through the provided workspace setter', () => {
    const onSelectWorkspace = vi.fn()

    renderTopCommand({ onSelectWorkspace })

    fireEvent.click(
      screen.getByRole('button', { name: /open command surface/i })
    )
    fireEvent.change(
      screen.getByPlaceholderText(/type a route, page, or workspace/i),
      { target: { value: 'night shift' } }
    )
    fireEvent.click(screen.getByText('Night Shift Labs'))

    expect(onSelectWorkspace).toHaveBeenCalledWith('night-shift-labs')
  })
})
