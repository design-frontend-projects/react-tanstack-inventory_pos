import { describe, expect, it } from 'vitest'
import {
  MODULE_DEFINITIONS,
  PERMISSION_LINKS,
  SCREEN_DEFINITIONS,
} from '#/features/auth/module-catalog'
import {
  isPermissionCode,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'

const CRM_PERMISSIONS = [
  'crm.view',
  'crm.profile_manage',
  'crm.timeline_view',
  'crm.timeline_note',
  'crm.loyalty_view',
  'crm.loyalty_manage',
  'crm.loyalty_redeem',
  'crm.loyalty_adjust',
  'crm.segment_view',
  'crm.segment_manage',
  'crm.analytics_view',
  'crm.settings_manage',
] as const

describe('crm module registration', () => {
  it('registers the crm module in the catalog', () => {
    const crmModule = MODULE_DEFINITIONS.find((module) => module.code === 'crm')

    expect(crmModule).toBeDefined()
    expect(crmModule?.rootPath).toBe('/crm/customers')
  })

  it('registers the five crm screens', () => {
    const screens = SCREEN_DEFINITIONS.filter((screen) => screen.moduleCode === 'crm')

    expect(screens.map((screen) => screen.code).sort()).toEqual([
      'crm-analytics',
      'crm-customers',
      'crm-dashboard',
      'crm-loyalty',
      'crm-segments',
    ])
  })

  it('defines and links every crm permission', () => {
    for (const code of CRM_PERMISSIONS) {
      expect(isPermissionCode(code), code).toBe(true)
      expect(
        PERMISSION_DEFINITIONS.find((permission) => permission.code === code),
        code
      ).toBeDefined()
      expect(PERMISSION_LINKS[code].moduleCode, code).toBe('crm')
    }
  })
})

describe('crm role wiring', () => {
  it('defines the crm_manager role', () => {
    const role = ROLE_DEFINITIONS.find((definition) => definition.code === 'crm_manager')

    expect(role).toBeDefined()
    expect(role?.rank).toBe(57)
  })

  it('grants crm_manager every crm permission', () => {
    for (const code of CRM_PERMISSIONS) {
      expect(ROLE_PERMISSION_MAP.crm_manager, code).toContain(code)
    }
  })

  it('grants admin every crm permission', () => {
    for (const code of CRM_PERMISSIONS) {
      expect(ROLE_PERMISSION_MAP.admin, code).toContain(code)
    }
  })

  it('grants the POS cashier loyalty view + redeem only', () => {
    expect(ROLE_PERMISSION_MAP.pos_cashier).toContain('crm.loyalty_view')
    expect(ROLE_PERMISSION_MAP.pos_cashier).toContain('crm.loyalty_redeem')
    expect(ROLE_PERMISSION_MAP.pos_cashier).not.toContain('crm.loyalty_manage')
    expect(ROLE_PERMISSION_MAP.pos_cashier).not.toContain('crm.settings_manage')
  })

  it('gives sales managers read/analyze access without program administration', () => {
    expect(ROLE_PERMISSION_MAP.sales_manager).toContain('crm.view')
    expect(ROLE_PERMISSION_MAP.sales_manager).toContain('crm.analytics_view')
    expect(ROLE_PERMISSION_MAP.sales_manager).not.toContain('crm.loyalty_manage')
  })
})
