import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { ResOrderStatus, ResPaymentMethod } from '#/server/db/generated/prisma/client'
import { ConflictError, NotFoundError, ValidationError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { serializeOrder } from '#/server/restaurant/orders/order-dto'
import { computeOrderTotals } from '#/server/restaurant/orders/order-totals'
import type { TotalsCharge, TotalsItem } from '#/server/restaurant/orders/order-totals'
import {
  canItemTransition,
  canTransition,
  hasConsumedInventory,
  itemStatusRank,
} from '#/server/restaurant/orders/order-state-machine'
import type {
  ResOrderItemStatusValue,
  ResOrderStatusValue,
} from '#/server/restaurant/orders/order-state-machine'
import { consumeOrderInventory } from '#/server/restaurant/orders/inventory-consumption'
import * as orderRepo from '#/server/repos/res-order-repo'
import * as branchRepo from '#/server/repos/res-branch-repo'
import * as itemRepo from '#/server/repos/res-menu-item-repo'
import * as tableRepo from '#/server/repos/res-table-repo'
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
      // Serialize concurrent seat/transfer attempts on the same table before
      // running the one-active-order-per-table check (no DB constraint backs it).
      await tableRepo.lockTableForUpdate(tenantId, input.tableId, tx)
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

// Exposed for sibling services (e.g. promotions) that add or remove discount
// rows and must re-derive the order rollup inside their own transaction.
export async function recomputeOrderTotals(
  tenantId: string,
  orderId: string,
  tx: Prisma.TransactionClient,
) {
  await recomputeTotals(tenantId, orderId, tx)
}

// Recompute and persist the order's monetary rollup from its current rows.
async function recomputeTotals(
  tenantId: string,
  orderId: string,
  tx: Prisma.TransactionClient
) {
  const allItems = await orderRepo.listItems(tenantId, orderId, tx)
  const items = allItems.filter((item) => item.status !== 'VOIDED')
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
    const extra: Record<string, unknown> = {}
    if (toStatus === 'CONFIRMED') {
      extra.confirmedAt = new Date()
    }
    if (toStatus === 'SERVED') {
      extra.servedAt = new Date()
    }

    // Atomic compare-and-set: a concurrent transition (double-tap on "Mark
    // served" / "Bump") loses here and must not re-run the side effects below.
    const won = await orderRepo.setStatusIf(
      tenantId,
      id,
      order.status,
      toStatus,
      extra,
      tx
    )
    if (!won) {
      throw new ConflictError('Order status changed — refresh and retry')
    }

    // Serving is the consumption point of the state machine: post the inventory
    // movements here so completing a SERVED order later doesn't skip them.
    if (toStatus === 'SERVED' && !hasConsumedInventory(order.status as ResOrderStatusValue)) {
      const items = await orderRepo.listItems(tenantId, id, tx)
      const consumable = items.filter((item) => item.status !== 'VOIDED')

      await consumeOrderInventory(tx, {
        tenantId,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          warehouseId: order.warehouseId,
          locationId: order.locationId,
        },
        items: consumable.map((i) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
        performedByProfileId: context.profileId,
      })

      // Everything that reached the guest is served.
      await orderRepo.updateItemStatuses(
        tenantId,
        id,
        consumable.filter((i) => i.status !== 'SERVED').map((i) => i.id),
        'SERVED',
        tx
      )
    }

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

// --- Item-level kitchen progression -----------------------------------------

export interface UpdateItemStatusInput {
  orderId: string
  itemIds?: Array<string>
  toStatus: 'FIRED' | 'PREPARING' | 'READY' | 'SERVED'
}

// Advance order items through the kitchen flow (forward-only, idempotent for
// items already at or past the target). Auto-advances the parent order when the
// item states imply it: first PREPARING item moves a CONFIRMED order to
// PREPARING; all items READY+ moves the order to READY. Order-level SERVED
// stays an explicit action (it posts inventory movements).
export async function updateItemStatus(
  context: CurrentUserContext,
  tenantId: string,
  input: UpdateItemStatusInput
) {
  const order = await orderRepo.findOrderById(tenantId, input.orderId)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  const orderStatus = order.status as ResOrderStatusValue
  if (['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOIDED'].includes(orderStatus)) {
    throw new ValidationError('Order is closed — item statuses can no longer change')
  }

  const items = await orderRepo.listItems(tenantId, input.orderId)
  const targeted = input.itemIds?.length
    ? items.filter((item) => input.itemIds?.includes(item.id))
    : items

  const eligible = targeted.filter((item) =>
    canItemTransition(item.status as ResOrderItemStatusValue, input.toStatus)
  )

  if (input.itemIds?.length && eligible.length === 0) {
    throw new ValidationError('No selected items can move to that status')
  }

  await prisma.$transaction(async (tx) => {
    await orderRepo.updateItemStatuses(
      tenantId,
      input.orderId,
      eligible.map((item) => item.id),
      input.toStatus,
      tx
    )

    // Project the post-update item states to decide order auto-advance.
    const eligibleIds = new Set(eligible.map((item) => item.id))
    const nextStates = items
      .filter((item) => item.status !== 'VOIDED')
      .map((item) =>
        eligibleIds.has(item.id)
          ? input.toStatus
          : (item.status as ResOrderItemStatusValue)
      )

    let nextOrderStatus: ResOrderStatusValue | null = null
    const allReadyOrBeyond =
      nextStates.length > 0 &&
      nextStates.every((status) => itemStatusRank(status) >= itemStatusRank('READY'))

    if (allReadyOrBeyond && canTransition(orderStatus, 'READY')) {
      nextOrderStatus = 'READY'
    } else if (
      input.toStatus === 'PREPARING' &&
      canTransition(orderStatus, 'PREPARING')
    ) {
      nextOrderStatus = 'PREPARING'
    }

    if (nextOrderStatus && nextOrderStatus !== orderStatus) {
      await orderRepo.setStatus(tenantId, input.orderId, nextOrderStatus, {}, tx)
    }

    await orderRepo.appendOrderEvent(
      tenantId,
      {
        orderId: input.orderId,
        fromStatus: order.status,
        toStatus: nextOrderStatus ?? order.status,
        actorProfileId: context.profileId,
        payloadJson: {
          kind: 'item_status',
          itemIds: eligible.map((item) => item.id),
          toStatus: input.toStatus,
        },
      },
      tx
    )
  })

  return getOrder(context, tenantId, input.orderId)
}

// Void a single line before inventory has been consumed; totals are recomputed
// without it. The row is kept for the audit trail.
export async function voidOrderItem(
  context: CurrentUserContext,
  tenantId: string,
  input: { orderId: string; itemId: string; reason?: string | null }
) {
  const order = await orderRepo.findOrderById(tenantId, input.orderId)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  const orderStatus = order.status as ResOrderStatusValue
  if (
    hasConsumedInventory(orderStatus) ||
    ['CANCELLED', 'VOIDED'].includes(orderStatus)
  ) {
    throw new ValidationError('Items can no longer be removed from this order')
  }

  const items = await orderRepo.listItems(tenantId, input.orderId)
  const item = items.find((candidate) => candidate.id === input.itemId)
  if (!item) {
    throw new NotFoundError('Order item not found')
  }
  if (item.status === 'VOIDED') {
    throw new ValidationError('Item is already voided')
  }

  await prisma.$transaction(async (tx) => {
    await orderRepo.updateItemStatuses(tenantId, input.orderId, [item.id], 'VOIDED', tx)
    await recomputeTotals(tenantId, input.orderId, tx)
    await orderRepo.appendOrderEvent(
      tenantId,
      {
        orderId: input.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorProfileId: context.profileId,
        reason: input.reason ?? null,
        payloadJson: { kind: 'item_void', itemId: item.id, name: item.name },
      },
      tx
    )
  })

  return getOrder(context, tenantId, input.orderId)
}

// Move an active order to another table (classic table transfer). The target
// must be free, active, and in the same branch.
export async function transferOrderTable(
  context: CurrentUserContext,
  tenantId: string,
  input: { orderId: string; toTableId: string; reason?: string | null }
) {
  const order = await orderRepo.findOrderById(tenantId, input.orderId)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  const orderStatus = order.status as ResOrderStatusValue
  if (['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOIDED'].includes(orderStatus)) {
    throw new ValidationError('Closed orders cannot be transferred')
  }
  if (order.tableId === input.toTableId) {
    throw new ValidationError('Order is already on that table')
  }

  const target = await tableRepo.findTableById(tenantId, input.toTableId)
  if (!target || !target.isActive || target.branchId !== order.branchId) {
    throw new NotFoundError('Target table not found in this branch')
  }
  if (target.status === 'BLOCKED') {
    throw new ConflictError('Target table is blocked')
  }

  await prisma.$transaction(async (tx) => {
    // Serialize with concurrent seats/transfers targeting the same table.
    await tableRepo.lockTableForUpdate(tenantId, input.toTableId, tx)
    const occupied = await orderRepo.findActiveOrderForTable(
      tenantId,
      order.branchId,
      input.toTableId,
      tx
    )
    if (occupied) {
      throw new ConflictError('Target table already has an active order')
    }

    await orderRepo.setOrderTable(tenantId, input.orderId, input.toTableId, tx)
    await orderRepo.addTransfer(
      tenantId,
      {
        orderId: input.orderId,
        fromTableId: order.tableId,
        toTableId: input.toTableId,
        actorProfileId: context.profileId,
      },
      tx
    )
    await orderRepo.appendOrderEvent(
      tenantId,
      {
        orderId: input.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorProfileId: context.profileId,
        reason: input.reason ?? null,
        payloadJson: {
          kind: 'table_transfer',
          fromTableId: order.tableId,
          toTableId: input.toTableId,
        },
      },
      tx
    )
  })

  return getOrder(context, tenantId, input.orderId)
}

// --- Kitchen board projection ------------------------------------------------

export interface KitchenBoardTicketItem {
  id: string
  name: string
  quantity: string
  status: string
  stationId: string | null
  specialRequest: string | null
  modifiers: Array<{ name: string; quantity: number }>
}

export interface KitchenBoardTicket {
  orderId: string
  orderNumber: string
  status: string
  orderType: string
  tableCode: string | null
  guestCount: number
  notes: string | null
  kitchenNotes: string | null
  confirmedAt: string
  totalItemCount: number
  items: Array<KitchenBoardTicketItem>
}

// Tickets are derived from in-kitchen orders' items; when a station filter is
// given, each ticket keeps only that station's items (tickets left empty are
// dropped) while totalItemCount still reflects the whole order.
export async function getKitchenBoard(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string; stationId?: string | null }
): Promise<Array<KitchenBoardTicket>> {
  const orders = await prisma.resOrder.findMany({
    where: {
      tenantId,
      branchId: input.branchId,
      deletedAt: null,
      status: { in: ['CONFIRMED', 'PREPARING', 'COOKING', 'READY'] },
    },
    include: { items: { include: { modifiers: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  const tableIds = [
    ...new Set(orders.map((order) => order.tableId).filter(Boolean) as Array<string>),
  ]
  const tables = tableIds.length
    ? await prisma.resTable.findMany({
        where: { tenantId, id: { in: tableIds } },
        select: { id: true, code: true },
      })
    : []
  const tableCodes = new Map(tables.map((table) => [table.id, table.code]))

  const tickets: Array<KitchenBoardTicket> = []

  for (const order of orders) {
    const liveItems = order.items.filter((item) => item.status !== 'VOIDED')
    const stationItems = input.stationId
      ? liveItems.filter((item) => item.stationId === input.stationId)
      : liveItems

    if (stationItems.length === 0) {
      continue
    }

    tickets.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      tableCode: order.tableId ? (tableCodes.get(order.tableId) ?? null) : null,
      guestCount: order.guestCount,
      notes: order.notes,
      kitchenNotes: order.kitchenNotes,
      confirmedAt: (order.confirmedAt ?? order.createdAt).toISOString(),
      totalItemCount: liveItems.length,
      items: stationItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity.toString(),
        status: item.status,
        stationId: item.stationId,
        specialRequest: item.specialRequest,
        modifiers: item.modifiers.map((modifier) => ({
          name: modifier.name,
          quantity: modifier.quantity,
        })),
      })),
    })
  }

  return tickets
}

export interface PaymentInput {
  method: ResPaymentMethod
  amount: string
  reference?: string | null
  giftCardId?: string | null
  // Optional named bill split; payments sharing a label become one
  // ResOrderSplit row with the summed amount.
  splitLabel?: string | null
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
    // Atomic compare-and-set first — a concurrent completion loses here and the
    // payments/consumption below never run twice.
    const won = await orderRepo.setStatusIf(
      tenantId,
      id,
      order.status,
      'COMPLETED',
      { completedAt: new Date(), closedByProfileId: context.profileId },
      tx
    )
    if (!won) {
      throw new ConflictError('Order status changed — refresh and retry')
    }

    const allItems = await orderRepo.listItems(tenantId, id, tx)
    const items = allItems.filter((item) => item.status !== 'VOIDED')

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

    // Named bill splits: payments sharing a splitLabel settle one split row.
    const splitIdsByLabel = new Map<string, string>()
    const splitLabels = [
      ...new Set(
        payments
          .map((payment) => payment.splitLabel?.trim())
          .filter((label): label is string => Boolean(label))
      ),
    ]
    for (const label of splitLabels) {
      const splitAmount = payments
        .filter((payment) => payment.splitLabel?.trim() === label)
        .reduce((sum, payment) => sum.plus(new Prisma.Decimal(payment.amount)), new Prisma.Decimal(0))
      const split = await orderRepo.addSplit(
        tenantId,
        { orderId: id, label, amount: splitAmount.toString(), isPaid: true },
        tx
      )
      splitIdsByLabel.set(label, split.id)
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
          splitId: payment.splitLabel?.trim()
            ? (splitIdsByLabel.get(payment.splitLabel.trim()) ?? null)
            : null,
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
// Merge one open order into another: the source's live lines, charges, and
// discounts move to the target, the target's totals are recomputed, and the
// source is voided with a cross-referencing audit trail. Payments block a
// merge — settle or refund the source first.
export async function mergeOrders(
  context: CurrentUserContext,
  tenantId: string,
  input: { targetId: string; sourceId: string }
) {
  if (input.targetId === input.sourceId) {
    throw new ValidationError('Cannot merge an order into itself')
  }

  const [target, source] = await Promise.all([
    orderRepo.findOrderById(tenantId, input.targetId),
    orderRepo.findOrderById(tenantId, input.sourceId),
  ])
  if (!target || !source) {
    throw new NotFoundError('Order not found')
  }
  if (target.branchId !== source.branchId) {
    throw new ValidationError('Orders must belong to the same branch to merge')
  }
  const closed = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOIDED']
  if (closed.includes(target.status) || closed.includes(source.status)) {
    throw new ValidationError('Closed orders cannot be merged')
  }
  if (new Prisma.Decimal(source.amountPaid).greaterThan(0)) {
    throw new ValidationError(
      'The source order has captured payments — settle or refund it first'
    )
  }

  await prisma.$transaction(async (tx) => {
    // Move live lines (with their kitchen statuses and modifiers), charges,
    // and discounts onto the target.
    await tx.resOrderItem.updateMany({
      where: { tenantId, orderId: source.id },
      data: { orderId: target.id },
    })
    await tx.resOrderCharge.updateMany({
      where: { tenantId, orderId: source.id },
      data: { orderId: target.id },
    })
    await tx.resOrderDiscount.updateMany({
      where: { tenantId, orderId: source.id },
      data: { orderId: target.id },
    })

    await recomputeTotals(tenantId, target.id, tx)
    await orderRepo.updateOrderTotals(
      tenantId,
      source.id,
      {
        subtotal: '0',
        discountTotal: '0',
        taxTotal: '0',
        serviceChargeTotal: '0',
        deliveryFee: '0',
        tipTotal: '0',
        roundingTotal: '0',
        grandTotal: '0',
      },
      tx
    )
    await orderRepo.setStatus(tenantId, source.id, 'VOIDED', {}, tx)

    await orderRepo.appendOrderEvent(
      tenantId,
      {
        orderId: source.id,
        fromStatus: source.status,
        toStatus: 'VOIDED',
        actorProfileId: context.profileId,
        reason: `Merged into ${target.orderNumber}`,
        payloadJson: { kind: 'merge', targetOrderId: target.id },
      },
      tx
    )
    await orderRepo.appendOrderEvent(
      tenantId,
      {
        orderId: target.id,
        fromStatus: target.status,
        toStatus: target.status,
        actorProfileId: context.profileId,
        reason: `Absorbed ${source.orderNumber}`,
        payloadJson: { kind: 'merge', sourceOrderId: source.id },
      },
      tx
    )
  })

  return getOrder(context, tenantId, input.targetId)
}

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
