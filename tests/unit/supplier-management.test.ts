import { describe, expect, it } from 'vitest'
import {
  supplierAddressSchema,
  supplierBankSchema,
  supplierCategorySchema,
  supplierContactSchema,
  supplierCreateSchema,
  supplierListSchema,
  supplierUpdateSchema,
} from '#/features/suppliers/validation'
import {
  serializeSupplierDetail,
  serializeSupplierSummary,
} from '#/server/purchasing/supplier-dto'
import {
  isPermissionCode,
  ROLE_PERMISSION_MAP,
} from '#/features/auth/rbac-catalog'
import { PERMISSION_LINKS } from '#/features/auth/module-catalog'

// Minimal Decimal-like stub matching the { toString } contract the DTO relies on.
const dec = (value: string) => ({ toString: () => value })

describe('supplier validation', () => {
  it('accepts a well-formed supplier create payload', () => {
    const parsed = supplierCreateSchema.parse({
      code: 'SUP-001',
      name: 'Acme Foods',
      email: 'buyer@acme.test',
      currencyCode: 'USD',
      creditLimit: '15000.00',
      rating: 4.5,
      leadTimeDays: 7,
      isPreferred: true,
      tags: ['produce', 'preferred'],
    })

    expect(parsed.code).toBe('SUP-001')
    expect(parsed.isPreferred).toBe(true)
  })

  it('rejects a supplier without a code or name', () => {
    expect(supplierCreateSchema.safeParse({ name: 'No Code' }).success).toBe(
      false,
    )
    expect(supplierCreateSchema.safeParse({ code: 'NC' }).success).toBe(false)
  })

  it('rejects an invalid email and out-of-range rating', () => {
    expect(
      supplierCreateSchema.safeParse({
        code: 'A',
        name: 'A',
        email: 'not-an-email',
      }).success,
    ).toBe(false)
    expect(
      supplierCreateSchema.safeParse({ code: 'A', name: 'A', rating: 9 })
        .success,
    ).toBe(false)
  })

  it('allows a partial update payload', () => {
    const parsed = supplierUpdateSchema.parse({ isPreferred: false })
    expect(parsed.isPreferred).toBe(false)
    expect(supplierUpdateSchema.safeParse({}).success).toBe(true)
  })

  it('validates list, contact, address, bank, and category schemas', () => {
    expect(
      supplierListSchema.safeParse({ page: 2, pageSize: 50 }).success,
    ).toBe(true)
    expect(supplierListSchema.safeParse({ pageSize: 9999 }).success).toBe(false)

    expect(
      supplierContactSchema.safeParse({
        supplierId: '11111111-1111-4111-8111-111111111111',
        name: 'Jane Buyer',
        email: 'jane@acme.test',
        isPrimary: true,
      }).success,
    ).toBe(true)

    expect(
      supplierAddressSchema.safeParse({
        supplierId: '11111111-1111-4111-8111-111111111111',
        addressType: 'billing',
        line1: '1 Market St',
      }).success,
    ).toBe(true)
    expect(
      supplierAddressSchema.safeParse({
        supplierId: '11111111-1111-4111-8111-111111111111',
        addressType: 'invalid',
        line1: 'x',
      }).success,
    ).toBe(false)

    expect(
      supplierBankSchema.safeParse({
        supplierId: '11111111-1111-4111-8111-111111111111',
        bankName: 'First Bank',
        iban: 'GB00XXXX',
      }).success,
    ).toBe(true)

    expect(
      supplierCategorySchema.safeParse({
        code: 'FOOD',
        name: 'Food & Beverage',
      }).success,
    ).toBe(true)
  })
})

describe('supplier DTO serialization', () => {
  const supplier = {
    id: 'sup-1',
    tenantId: 'tenant-1',
    code: 'SUP-001',
    name: 'Acme Foods',
    currencyCode: 'USD',
    isPreferred: true,
    statusCode: 'active',
    isActive: true,
    creditLimit: dec('15000'),
    currentBalance: dec('2500.50'),
    rating: dec('4.50'),
    leadTimeDays: 7,
  }

  it('stringifies Decimal money/rating fields on the summary', () => {
    const result = serializeSupplierSummary(supplier as never)
    expect(result.creditLimit).toBe('15000')
    expect(result.currentBalance).toBe('2500.50')
    expect(result.rating).toBe('4.50')
  })

  it('keeps null credit limit / rating as null', () => {
    const result = serializeSupplierSummary({
      ...supplier,
      creditLimit: null,
      rating: null,
    } as never)
    expect(result.creditLimit).toBeNull()
    expect(result.rating).toBeNull()
  })

  it('serializes a detail payload with satellites', () => {
    const result = serializeSupplierDetail({
      ...supplier,
      contacts: [{ id: 'c1', name: 'Jane' }],
      addresses: [{ id: 'a1', line1: '1 Market St' }],
      bankAccounts: [{ id: 'b1', bankName: 'First Bank' }],
    } as never)

    expect(result.currentBalance).toBe('2500.50')
    expect(result.contacts).toHaveLength(1)
    expect(result.addresses).toHaveLength(1)
    expect(result.bankAccounts).toHaveLength(1)
  })
})

describe('supplier CRM RBAC wiring', () => {
  it('grants purchasing_officer the supplier + config surface', () => {
    const grants = ROLE_PERMISSION_MAP.purchasing_officer
    expect(grants).toContain('supplier.view')
    expect(grants).toContain('supplier.manage')
    expect(grants).toContain('purchase.config_manage')
  })

  it('links the supplier-facing purchase permission to the purchase module', () => {
    expect(isPermissionCode('purchase.config_manage')).toBe(true)
    expect(PERMISSION_LINKS['purchase.config_manage'].moduleCode).toBe(
      'purchase',
    )
  })
})
