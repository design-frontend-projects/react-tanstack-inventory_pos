import { describe, expect, it } from 'vitest'
import { Prisma } from '#/server/db/generated/prisma/client'
import {
  DOMAIN_EVENT_TYPES,
  isDomainEventType,
} from '#/server/events/domain-event-types'
import type { PosSaleCompletedPayload } from '#/server/events/domain-event-types'

describe('domain event catalog', () => {
  it('registers every emitted event type', () => {
    for (const eventType of [
      'customer.created',
      'customer.updated',
      'pos_sale.completed',
      'pos_sale.voided',
      'pos_sale.refunded',
      'sales_order.confirmed',
      'sales_order.fulfilled',
      'sales_order.cancelled',
      'sales_invoice.issued',
      'sales_invoice.paid',
      'sales_return.credited',
      'financial_note.issued',
      'crm.consent_changed',
      'crm.loyalty_earned',
      'crm.loyalty_redeemed',
      'crm.loyalty_adjusted',
      'crm.loyalty_expired',
      'crm.segment_entered',
      'crm.segment_exited',
    ]) {
      expect(isDomainEventType(eventType), eventType).toBe(true)
    }
  })

  it('has no duplicate event types', () => {
    expect(new Set(DOMAIN_EVENT_TYPES).size).toBe(DOMAIN_EVENT_TYPES.length)
  })

  it('rejects unknown event types', () => {
    expect(isDomainEventType('pos_sale.parked')).toBe(false)
    expect(isDomainEventType('')).toBe(false)
  })
})

describe('event payload Decimal-as-string contract', () => {
  it('round-trips a POS sale payload through JSON without precision loss', () => {
    const grandTotal = new Prisma.Decimal('1234.5678')
    const quantity = new Prisma.Decimal('3.25')

    const payload: PosSaleCompletedPayload = {
      documentNumber: 'POS-000042',
      warehouseId: '00000000-0000-0000-0000-000000000001',
      orderType: 'RETAIL',
      currencyCode: 'USD',
      subtotal: '1200.0000',
      discountTotal: '0.0000',
      taxTotal: '34.5678',
      grandTotal: grandTotal.toString(),
      amountPaid: '1240.0000',
      paymentMethods: ['CASH', 'CARD'],
      lines: [
        {
          productId: '00000000-0000-0000-0000-000000000002',
          variantId: null,
          quantity: quantity.toString(),
          unitPrice: '369.3747',
          lineTotal: '1200.4678',
        },
      ],
    }

    const revived = JSON.parse(JSON.stringify(payload)) as PosSaleCompletedPayload

    expect(new Prisma.Decimal(revived.grandTotal).equals(grandTotal)).toBe(true)
    expect(new Prisma.Decimal(revived.lines[0].quantity).equals(quantity)).toBe(true)
  })
})
