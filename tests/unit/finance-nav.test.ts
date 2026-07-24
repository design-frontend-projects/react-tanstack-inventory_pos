import { describe, expect, it } from 'vitest'
import {
  MODULE_DEFINITIONS,
  PERMISSION_LINKS,
  SCREEN_DEFINITIONS,
} from '#/features/auth/module-catalog'
import {
  isPermissionCode,
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { appNavSections } from '#/lib/navigation/app-nav'

const FINANCE_PERMISSIONS = [
  'finance.account_view',
  'finance.account_manage',
  'finance.fiscal_manage',
  'finance.journal_view',
  'finance.journal_create',
  'finance.journal_post',
  'finance.journal_reverse',
  'finance.settings_manage',
  'finance.posting_manage',
] as const

describe('finance module registration', () => {
  const financeScreens = SCREEN_DEFINITIONS.filter(
    (screen) => screen.moduleCode === 'finance',
  )

  it('registers the finance module rooted at the dashboard', () => {
    const financeModule = MODULE_DEFINITIONS.find(
      (module) => module.code === 'finance',
    )

    expect(financeModule).toBeDefined()
    expect(financeModule?.rootPath).toBe('/finance/dashboard')
  })

  it('registers the full financial management screen set', () => {
    expect(financeScreens.length).toBe(36)
    expect(financeScreens.map((screen) => screen.code)).toContain(
      'finance-dashboard',
    )
  })

  it('gates every finance screen with a real permission', () => {
    for (const screen of financeScreens) {
      expect(
        isPermissionCode(screen.defaultPermissionCode ?? ''),
        screen.code,
      ).toBe(true)
    }
  })

  it('keeps screen paths unique and finance-prefixed', () => {
    const paths = financeScreens.map((screen) => screen.path)

    expect(new Set(paths).size).toBe(paths.length)
    for (const path of paths) {
      expect(path.startsWith('/finance/')).toBe(true)
    }
  })

  it('links every finance permission to a finance screen', () => {
    for (const code of FINANCE_PERMISSIONS) {
      expect(
        PERMISSION_DEFINITIONS.find((permission) => permission.code === code),
        code,
      ).toBeDefined()
      expect(PERMISSION_LINKS[code].moduleCode, code).toBe('finance')
      expect(
        financeScreens.find(
          (screen) => screen.code === PERMISSION_LINKS[code].screenCode,
        ),
        code,
      ).toBeDefined()
    }
  })
})

describe('finance static navigation', () => {
  const financeSection = appNavSections.find(
    (section) => section.id === 'finance',
  )

  it('exposes the finance section in the static sidebar fallback', () => {
    expect(financeSection).toBeDefined()
    expect(financeSection?.rootTo).toBe('/finance/dashboard')
  })

  it('mirrors every catalog screen as a nav item', () => {
    const financeScreens = SCREEN_DEFINITIONS.filter(
      (screen) => screen.moduleCode === 'finance',
    )
    const navPaths = new Set(
      (financeSection?.items ?? []).map((item) => item.to as string),
    )

    for (const screen of financeScreens) {
      expect(navPaths.has(screen.path), screen.path).toBe(true)
    }
  })

  it('gates every nav item with existing permission codes', () => {
    for (const item of financeSection?.items ?? []) {
      for (const permission of item.permissions ?? []) {
        expect(isPermissionCode(permission), `${item.id}: ${permission}`).toBe(
          true,
        )
      }
    }
  })
})

describe('finance role wiring', () => {
  it('grants finance_manager every finance permission', () => {
    for (const code of FINANCE_PERMISSIONS) {
      expect(ROLE_PERMISSION_MAP.finance_manager, code).toContain(code)
    }
  })
})
