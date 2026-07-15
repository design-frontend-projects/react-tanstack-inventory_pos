import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { ResOrderStatus, ResPaymentMethod } from '#/server/db/generated/prisma/client'
import { ConflictError, NotFoundError, ValidationError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { serializeOrder } from '#/server/restaurant/orders/order-dto'
import { computeOrderTotals } from '#/server/restaurant/orders/order-totals'
import type { TotalsCharge, TotalsItem } from '#/server/restaurant/orders/order-totals'
import { canTransition, hasConsumedInventory } from '#/server/restaurant/orders/order-state-machine'
import type { ResOrderStatusValue } from '#/server/restaurant/orders/order-state-machine'
import { consumeOrderInventory } from '#/server/restaurant/orders/inventory-consumption'
import * as orderRepo from '#/server/repos/res-order-repo'
import * as branchRepo from '#/server/repos/res-branch-repo'
import * as itemRepo from '#/server/repos/res-menu-item-repo'
import * as sequenceRepo from '#/server/repos/res-number-sequence-repo'
import type { CurrentUserContext } from '#/types/auth'
import type { RestaurantOrderLine } from '#/server/events/domain-event-types'

export async function listOrders(
  _context: CurrentUserContext,
  tenantId: string,
  options: { branchId?: string; status?: ResOrderStatus } = {}
) {
  const orders = await orderRepo.listOrders(tenantId, options)
  return orders.map(serializeOrder)
}

export async function getOrder(_context: CurrentUserContext, tenantId: string, id: string) {
  const order = await orderRepo.findOrderWithLines(tenantId, id)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  return serializeOrder(order)
}

export interface CreateOrderInput {
  branchId: string
  tableId?: string | null
  customerId?: string | null
  serviceTypeId?: string | null
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'PICKUP' | 'DELIVERY' | 'DRIVE_THRU'
  channel?: 'POS' | 'QR' | 'WEBSITE' | 'MOBILE_APP' | 'PHONE' | 'THIRD_PARTY'
  guestCount?: number
  notes?: string | null
}

// Open a draft order for a branch. Enforces one active order per table and
// issues the branch order number atomically.
export async function createOrder(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateOrderInput
) {
  const branch = await branchRepo.findBranchById(tenantId, input.branchId)
  if (!branch) {
    throw new NotFoundError('Branch not found')
  }

  const order = await prisma.$transaction(async (tx) => {
    if (input.tableId) {
      const active = await orderRepo.findActiveOrderForTable(
        tenantId,
        input.branchId,
        input.tableId,
        tx
      )
      if (active) {
        throw new ConflictError('Table already has an active order')
      }
    }

    const issued = await sequenceRepo.issueNextNumber(
      tenantId,
      { branchId: input.branchId, sequenceType: 'ORDER' },
      tx
    )

    const created = await orderRepo.createOrder(
      tenantId,
      {
        branchId: input.branchId,
        orderNumber: issued.formatted,
        tableId: input.tableId ?? null,
        customerId: input.customerId ?? null,
        serviceTypeId: input.serviceTypeId ?? null,
        orderType: input.orderType,
        channel: input.channel,
        guestCount: input.guestCount,
        currencyCode: branch.currencyCode,
        warehouseId: branch.warehouseId,
        openedByProfileId: context.profileId,
        notes: input.notes ?? null,
      },
      tx
    )

    await orderRepo.appendOrderEvent(
      tenantId,
      { orderId: created.id, toStatus: 'DRAFT', actorProfileId: context.profileId },
      tx
    )

    return created
  })

  return serializeOrder(order)
}

export interface AddItemInput {
  orderId: string
  menuItemId: string
  variantId?: string | null
  quantity?: number
  unitPrice?: string
  stationId?: string | null
  specialRequest?: string | null
  modifiers?: Array<{ modifierId?: string | null; name: string; priceDelta?: string; quantity?: number }>
}

// Add an item to an editable order; resolves price from the menu item when not
// supplied, records modifiers, then recomputes order totals.
export async function addItem(
  _context: CurrentUserContext,
  tenantId: string,
  input: AddItemInput
) {
  const order = await orderRepo.findOrderById(tenantId, input.orderId)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  if (hasConsumedInventory(order.status as ResOrderStatusValue) || order.status === 'CANCELLED' || order.status === 'VOIDED') {
    throw new ValidationError('Cannot add items to an order in its current state')
  }

  const menuItem = await itemRepo.findMenuItemById(tenantId, input.menuItemId)
  if (!menuItem) {
    throw new NotFoundError('Menu item not found')
  }

  const quantity = input.quantity ?? 1
  const unitPrice = input.unitPrice ?? menuItem.basePrice.toString()

  await prisma.$transaction(async (tx) => {
    const modifiersTotal = (input.modifiers ?? []).reduce(
      (sum, m) => sum.plus(new Prisma.Decimal(m.priceDelta ?? 0).times(m.quantity ?? 1)),
      new Prisma.Decimal(0)
    )
    const lineTotal = new Prisma.Decimal(quantity).times(unitPrice).plus(modifiersTotal)

    const item = await orderRepo.addItem(
      tenantId,
      {
        orderId: input.orderId,
        menuItemId: input.menuItemId,
        variantId: input.variantId ?? null,
        productId: null,
        stationId: input.stationId ?? menuItem.kitchenStationId,
        name: menuItem.name,
        quantity,
        unitPrice,
        lineTotal: lineTotal.toString(),
        specialRequest: input.specialRequest ?? null,
      },
      tx
    )

    for (const modifier of input.modifiers ?? []) {
      await orderRepo.addItemModifier(
        tenantId,
        {
          orderItemId: item.id,
          modifierId: modifier.modifierId ?? null,
          name: modifier.name,
          priceDelta: modifier.priceDelta ?? 0,
          quantity: modifier.quantity ?? 1,
        },
        tx
      )
    }

    await recomputeTotals(tenantId, input.orderId, tx)
  })

  return getOrder(_context, tenantId, input.orderId)
}

// Recompute and persist the order's monetary rollup from its current rows.
async function recomputeTotals(
  tenantId: string,
  orderId: string,
  tx: Prisma.TransactionClient
) {
  const items = await orderRepo.listItems(tenantId, orderId, tx)
  const charges = await tx.resOrderCharge.findMany({ where: { tenantId, orderId } })
  const discounts = await tx.resOrderDiscount.findMany({ where: { tenantId, orderId } })

  const totalsItems: Array<TotalsItem> = items.map((item) => ({
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toString(),
    lineDiscount: item.lineDiscount.toString(),
    lineTax: item.lineTax.toString(),
    modifiersTotal: item.modifiers
      .reduce(
        (sum, m) => sum.plus(new Prisma.Decimal(m.priceDelta).times(m.quantity)),
        new Prisma.Decimal(0)
      )
      .toString(),
  }))
  const totalsCharges: Array<TotalsCharge> = charges.map((c) => ({
    kind: c.kind,
    amount: c.amount.toString(),
  }))
  const totalsDiscounts = discounts.map((d) => ({ amount: d.amount.toString() }))

  const totals = computeOrderTotals(totalsItems, totalsCharges, totalsDiscounts)
  await orderRepo.updateOrderTotals(tenantId, orderId, totals, tx)
}

// Generic guarded status transition (validates the state machine, logs the event).
export async function transition(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  toStatus: ResOrderStatus,
  reason?: string | null
) {
  const order = await orderRepo.findOrderById(tenantId, id)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  if (!canTransition(order.status as ResOrderStatusValue, toStatus as ResOrderStatusValue)) {
    throw new ValidationError(`Illegal transition ${order.status} -> ${toStatus}`)
  }

  await prisma.$transaction(async (tx) => {
    await orderRepo.setStatus(tenantId, id, toStatus, {}, tx)
    await orderRepo.appendOrderEvent(
      tenantId,
      {
        orderId: id,
        fromStatus: order.status,
        toStatus,
        actorProfileId: context.profileId,
        reason: reason ?? null,
      },
      tx
    )
  })

  return getOrder(context, tenantId, id)
}

export interface PaymentInput {
  method: ResPaymentMethod
  amount: string
  reference?: string | null
  giftCardId?: string | null
}

// Settle and complete an order: record payments, consume inventory (once),
// mark COMPLETED, and emit the domain event CRM/finance project from.
export async function completeOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  payments: ReadonlyArray<PaymentInput>
) {
  const order = await orderRepo.findOrderById(tenantId, id)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  if (!canTransition(order.status as ResOrderStatusValue, 'COMPLETED')) {
    throw new ValidationError(`Illegal transition ${order.status} -> COMPLETED`)
  }

  await prisma.$transaction(async (tx) => {
    const items = await orderRepo.listItems(tenantId, id, tx)

    // Consume inventory once, if not already consumed by a prior SERVED transition.
    if (!hasConsumedInventory(order.status as ResOrderStatusValue)) {
      await consumeOrderInventory(tx, {
        tenantId,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          warehouseId: order.warehouseId,
          locationId: order.locationId,
        },
        items: items.map((i) => ({ id: i.id, menuItemId: i.menuItemId, quantity: i.quantity })),
        performedByProfileId: context.profileId,
      })
    }

    let paid = new Prisma.Decimal(0)
    for (const payment of payments) {
      await orderRepo.addPayment(
        tenantId,
        {
          orderId: id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference ?? null,
          giftCardId: payment.giftCardId ?? null,
          createdByProfileId: context.profileId,
        },
        tx
      )
      paid = paid.plus(new Prisma.Decimal(payment.amount))
    }

    if (paid.lt(new Prisma.Decimal(order.grandTotal))) {
      throw new ValidationError('Payments do not cover the order grand total')
    }

    await orderRepo.incrementAmountPaid(tenantId, id, paid.toString(), tx)
    await orderRepo.setStatus(tenantId, id, 'COMPLETED', {
      completedAt: new Date(),
      closedByProfileId: context.profileId,
    }, tx)
    await orderRepo.appendOrderEvent(
      tenantId,
      { orderId: id, fromStatus: order.status, toStatus: 'COMPLETED', actorProfileId: context.profileId },
      tx
    )

    const lines: Array<RestaurantOrderLine> = items.map((item) => ({
      menuItemId: item.menuItemId,
      productId: item.productId,
      categoryId: null,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    }))

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_order.completed',
      aggregateType: 'restaurant_order',
      aggregateId: order.id,
      customerId: order.customerId,
      actorProfileId: context.profileId,
      payload: {
        documentNumber: order.orderNumber,
        branchId: order.branchId,
        orderType: order.orderType,
        serviceType: order.serviceTypeId ?? '',
        channel: order.channel,
        currencyCode: order.currencyCode,
        subtotal: order.subtotal.toString(),
        discountTotal: order.discountTotal.toString(),
        taxTotal: order.taxTotal.toString(),
        serviceChargeTotal: order.serviceChargeTotal.toString(),
        deliveryFee: order.deliveryFee.toString(),
        tipTotal: order.tipTotal.toString(),
        roundingTotal: order.roundingTotal.toString(),
        grandTotal: order.grandTotal.toString(),
        amountPaid: paid.toString(),
        paymentMethods: payments.map((p) => p.method),
        customerId: order.customerId,
        guestCount: order.guestCount,
        lines,
        promotions: [],
      },
    })
  })

  return getOrder(context, tenantId, id)
}

// Void an order (kitchen may already have fired); releases nothing consumed and
// emits the void event.
export async function voidOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  reason?: string | null
) {
  const order = await orderRepo.findOrderById(tenantId, id)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  if (!canTransition(order.status as ResOrderStatusValue, 'VOIDED')) {
    throw new ValidationError(`Illegal transition ${order.status} -> VOIDED`)
  }

  await prisma.$transaction(async (tx) => {
    await orderRepo.setStatus(tenantId, id, 'VOIDED', { voidReasonId: null }, tx)
    await orderRepo.appendOrderEvent(
      tenantId,
      { orderId: id, fromStatus: order.status, toStatus: 'VOIDED', actorProfileId: context.profileId, reason: reason ?? null },
      tx
    )
    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_order.voided',
      aggregateType: 'restaurant_order',
      aggregateId: order.id,
      customerId: order.customerId,
      actorProfileId: context.profileId,
      payload: { documentNumber: order.orderNumber, reason: reason ?? null },
    })
  })

  return getOrder(context, tenantId, id)
}
