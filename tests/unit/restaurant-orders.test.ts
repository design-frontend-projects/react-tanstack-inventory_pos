import { describe, expect, it } from 'vitest'
import {
  allowedTransitions,
  canItemTransition,
  canTransition,
  hasActiveReservation,
  hasConsumedInventory,
  isTerminal,
  ITEM_STATUS_FLOW,
  itemStatusRank,
} from '#/server/restaurant/orders/order-state-machine'
import {
  computeLineTotal,
  computeOrderTotals,
} from '#/server/restaurant/orders/order-totals'
import { DOMAIN_EVENT_TYPES } from '#/server/events/domain-event-types'

describe('order state machine', () => {
  it('allows the forward operational flow', () => {
    expect(canTransition('DRAFT', 'CONFIRMED')).toBe(true)
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true)
    expect(canTransition('READY', 'SERVED')).toBe(true)
    expect(canTransition('SERVED', 'COMPLETED')).toBe(true)
  })

  it('rejects illegal jumps and moves out of terminal states', () => {
    expect(canTransition('DRAFT', 'COMPLETED')).toBe(false)
    expect(canTransition('COMPLETED', 'OPEN')).toBe(false)
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false)
    expect(canTransition('VOIDED', 'COMPLETED')).toBe(false)
  })

  it('allows only a refund out of a completed order', () => {
    expect(allowedTransitions('COMPLETED')).toEqual(['REFUNDED'])
  })

  it('classifies terminal, consumed, and reserved states', () => {
    expect(isTerminal('COMPLETED')).toBe(true)
    expect(isTerminal('READY')).toBe(false)
    expect(hasConsumedInventory('SERVED')).toBe(true)
    expect(hasConsumedInventory('CONFIRMED')).toBe(false)
    expect(hasActiveReservation('CONFIRMED')).toBe(true)
    expect(hasActiveReservation('DRAFT')).toBe(false)
  })
})

describe('order item status machine', () => {
  it('allows forward moves, including skips', () => {
    expect(canItemTransition('PENDING', 'FIRED')).toBe(true)
    expect(canItemTransition('FIRED', 'PREPARING')).toBe(true)
    expect(canItemTransition('FIRED', 'READY')).toBe(true)
    expect(canItemTransition('READY', 'SERVED')).toBe(true)
  })

  it('rejects backward moves and no-ops', () => {
    expect(canItemTransition('SERVED', 'READY')).toBe(false)
    expect(canItemTransition('PREPARING', 'FIRED')).toBe(false)
    expect(canItemTransition('FIRED', 'FIRED')).toBe(false)
  })

  it('allows the kitchen recall exception (READY back to PREPARING)', () => {
    expect(canItemTransition('READY', 'PREPARING')).toBe(true)
    // Recall never reaches past READY — a served item cannot come back.
    expect(canItemTransition('SERVED', 'PREPARING')).toBe(false)
  })

  it('keeps VOIDED outside the kitchen flow', () => {
    expect(canItemTransition('VOIDED', 'FIRED')).toBe(false)
    expect(canItemTransition('PENDING', 'VOIDED')).toBe(false)
    expect(itemStatusRank('VOIDED')).toBe(-1)
  })

  it('ranks the flow in kitchen order', () => {
    expect(ITEM_STATUS_FLOW).toEqual([
      'PENDING',
      'FIRED',
      'PREPARING',
      'READY',
      'SERVED',
    ])
    expect(itemStatusRank('READY')).toBeGreaterThan(itemStatusRank('PREPARING'))
  })
})

describe('order totals', () => {
  it('computes a single line total with modifiers, discount, and tax', () => {
    expect(
      computeLineTotal({
        quantity: '2',
        unitPrice: '10',
        modifiersTotal: '3',
        lineDiscount: '1',
        lineTax: '2',
      })
    ).toBe('24') // 2*10 + 3 - 1 + 2
  })

  it('rolls up subtotal, discounts, charges, and grand total', () => {
    const totals = computeOrderTotals(
      [
        { quantity: '2', unitPrice: '10', modifiersTotal: '2', lineTax: '1' },
        { quantity: '1', unitPrice: '8' },
      ],
      [
        { kind: 'SERVICE_CHARGE', amount: '3' },
        { kind: 'DELIVERY_FEE', amount: '5' },
        { kind: 'TIP', amount: '4' },
      ],
      [{ amount: '6' }]
    )
    // subtotal = 2*10+2 + 8 = 30
    expect(totals.subtotal).toBe('30')
    expect(totals.taxTotal).toBe('1')
    expect(totals.discountTotal).toBe('6')
    expect(totals.serviceChargeTotal).toBe('3')
    expect(totals.deliveryFee).toBe('5')
    expect(totals.tipTotal).toBe('4')
    // grand = 30 - 6 + 1 + 3 + 5 + 4 = 37
    expect(totals.grandTotal).toBe('37')
  })

  it('handles an empty order', () => {
    const totals = computeOrderTotals([])
    expect(totals.subtotal).toBe('0')
    expect(totals.grandTotal).toBe('0')
  })
})

describe('order domain events', () => {
  it('registers the order lifecycle events', () => {
    expect(DOMAIN_EVENT_TYPES).toContain('restaurant_order.completed')
    expect(DOMAIN_EVENT_TYPES).toContain('restaurant_order.voided')
  })
})
