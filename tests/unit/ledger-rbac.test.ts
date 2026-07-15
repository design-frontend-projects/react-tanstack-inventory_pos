import { describe, expect, it } from 'vitest'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

const LEDGER_PERMISSIONS = [
  'warehouse.view',
  'warehouse.create',
  'warehouse.update',
  'warehouse.manage_locations',
  'inventory.view_stock',
  'inventory.view_movements',
  'adjustment.view',
  'adjustment.create',
  'adjustment.post',
] as const

describe('ledger RBAC catalog', () => {
  it('registers every warehousing/inventory/adjustment permission', () => {
    for (const code of LEDGER_PERMISSIONS) {
      expect(isPermissionCode(code)).toBe(true)
      expect(PERMISSION_LINKS[code]).toBeDefined()
      expect(PERMISSION_LINKS[code].moduleCode).toBe('inventory')
    }
  })

  it('grants warehouse_manager the warehousing + adjustment surface', () => {
    const grants = ROLE_PERMISSION_MAP.warehouse_manager

    for (const code of LEDGER_PERMISSIONS) {
      expect(grants).toContain(code)
    }
  })

  it('grants inventory_manager the ledger surface', () => {
    const grants = ROLE_PERMISSION_MAP.inventory_manager

    for (const code of LEDGER_PERMISSIONS) {
      expect(grants).toContain(code)
    }
  })
})
