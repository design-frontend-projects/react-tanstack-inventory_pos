import { describe, expect, it } from 'vitest'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

const CATALOG_PERMISSIONS = [
  'product.view',
  'product.create',
  'product.update',
  'product.delete',
  'product.manage_pricing',
  'product.manage_categories',
  'supplier.view',
  'supplier.manage',
  'customer.view',
  'customer.manage',
  'tax.manage',
] as const

describe('catalog RBAC catalog', () => {
  it('registers every catalog permission code', () => {
    for (const code of CATALOG_PERMISSIONS) {
      expect(isPermissionCode(code)).toBe(true)
    }
  })

  it('links every catalog permission to a module', () => {
    for (const code of CATALOG_PERMISSIONS) {
      expect(PERMISSION_LINKS[code]).toBeDefined()
      expect(PERMISSION_LINKS[code].moduleCode).toBe('inventory')
    }
  })

  it('grants the inventory_manager role the full catalog + master surface', () => {
    const grants = ROLE_PERMISSION_MAP.inventory_manager

    for (const code of CATALOG_PERMISSIONS) {
      expect(grants).toContain(code)
    }
  })

  it('grants super_admin all catalog permissions implicitly', () => {
    const grants = ROLE_PERMISSION_MAP.super_admin

    for (const code of CATALOG_PERMISSIONS) {
      expect(grants).toContain(code)
    }
  })
})
