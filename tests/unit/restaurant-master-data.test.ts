import { describe, expect, it } from 'vitest'
import { Prisma } from '#/server/db/generated/prisma/client'
import { formatSequenceValue } from '#/server/repos/res-number-sequence-repo'
import {
  serializeBranch,
  serializeServiceChargeRule,
  serializeTaxConfig,
} from '#/server/restaurant/master-data/master-data-dto'
import {
  branchCreateSchema,
  restaurantCreateSchema,
  serviceKindSchema,
  taxConfigCreateSchema,
} from '#/features/restaurant/master-data/validation'
import { SCREEN_DEFINITIONS } from '#/features/auth/module-catalog'
import { isPermissionCode } from '#/features/auth/rbac-catalog'
import {
  DOMAIN_EVENT_TYPES,
  isDomainEventType,
} from '#/server/events/domain-event-types'

describe('restaurant number sequence formatting', () => {
  it('pads the value and applies the prefix', () => {
    expect(formatSequenceValue('ORD-', 4, 1n)).toBe('ORD-0001')
    expect(formatSequenceValue('INV-', 6, 42n)).toBe('INV-000042')
  })

  it('handles a null prefix and values wider than the padding', () => {
    expect(formatSequenceValue(null, 4, 12345n)).toBe('12345')
    expect(formatSequenceValue('KOT-', 0, 7n)).toBe('KOT-7')
  })
})

describe('restaurant master-data validation', () => {
  it('accepts a well-formed restaurant', () => {
    const parsed = restaurantCreateSchema.parse({ code: 'main', name: 'Main Brand' })
    expect(parsed.code).toBe('main')
    expect(parsed.defaultCurrency).toBeUndefined()
  })

  it('rejects an empty restaurant code', () => {
    expect(() => restaurantCreateSchema.parse({ code: '', name: 'X' })).toThrow()
  })

  it('requires a uuid restaurantId on a branch', () => {
    expect(() =>
      branchCreateSchema.parse({ restaurantId: 'not-a-uuid', code: 'b1', name: 'Branch 1' })
    ).toThrow()
  })

  it('coerces a numeric tax rate to a numeric string', () => {
    const parsed = taxConfigCreateSchema.parse({
      code: 'vat',
      name: 'VAT',
      rate: 0.15,
    })
    expect(parsed.rate).toBe('0.15')
  })

  it('constrains service kind to the known enum members', () => {
    expect(serviceKindSchema.parse('DELIVERY')).toBe('DELIVERY')
    expect(() => serviceKindSchema.parse('teleport')).toThrow()
  })
})

describe('restaurant master-data serializers', () => {
  it('stringifies branch geo decimals and null-safes them', () => {
    const branch = {
      id: 'b',
      latitude: new Prisma.Decimal('24.713600'),
      longitude: null,
    } as never
    const dto = serializeBranch(branch)
    expect(dto.latitude).toBe('24.7136')
    expect(dto.longitude).toBeNull()
  })

  it('stringifies tax rate and service charge value', () => {
    const tax = { id: 't', rate: new Prisma.Decimal('0.15') } as never
    const charge = { id: 'c', value: new Prisma.Decimal('10.0000') } as never
    expect(serializeTaxConfig(tax).rate).toBe('0.15')
    expect(serializeServiceChargeRule(charge).value).toBe('10')
  })
})

describe('restaurant RBAC + registry wiring', () => {
  it('registers the restaurant-settings screen under the restaurant module', () => {
    const screen = SCREEN_DEFINITIONS.find((s) => s.code === 'restaurant-settings')
    expect(screen).toBeDefined()
    expect(screen?.moduleCode).toBe('restaurant')
    expect(screen?.path).toBe('/restaurant/settings')
    expect(screen?.defaultPermissionCode).toBe('res.settings.manage')
  })

  it('uses only real permission codes for the settings screen', () => {
    expect(isPermissionCode('res.settings.manage')).toBe(true)
    expect(isPermissionCode('res.dashboard.view')).toBe(true)
  })
})

describe('restaurant domain events', () => {
  it('registers the restaurant order lifecycle event types', () => {
    for (const type of [
      'restaurant_order.completed',
      'restaurant_order.refunded',
      'restaurant_order.voided',
    ]) {
      expect(isDomainEventType(type)).toBe(true)
      expect(DOMAIN_EVENT_TYPES).toContain(type)
    }
  })

  it('does not treat an unknown type as a domain event', () => {
    expect(isDomainEventType('restaurant_order.exploded')).toBe(false)
  })
})
