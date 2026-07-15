import { prisma } from '#/server/db/client'
import type {
  ResOrderChannel,
  ResOrderChargeKind,
  ResOrderStatus,
  ResOrderType,
  ResPaymentMethod,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResOrderCreateInput {
  branchId: string
  orderNumber: string
  tableId?: string | null
  customerId?: string | null
  serviceTypeId?: string | null
  orderType?: ResOrderType
  channel?: ResOrderChannel
  guestCount?: number
  currencyCode?: string
  warehouseId?: string | null
  locationId?: string | null
  openedByProfileId?: string | null
  notes?: string | null
}

export interface ResOrderItemCreateInput {
  orderId: string
  menuItemId: string
  variantId?: string | null
  productId?: string | null
  stationId?: string | null
  name: string
  quantity: string | number
  unitPrice: string | number
  lineDiscount?: string | number
  lineTax?: string | number
  lineTotal: string | number
  specialRequest?: string | null
}

export function findOrderById(tenantId: string, id: string, client: PrismaClientLike = prisma) {
  return client.resOrder.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function findOrderWithLines(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resOrder.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { items: { include: { modifiers: true } }, payments: true, charges: true, discounts: true },
  })
}

export function listOrders(
  tenantId: string,
  options: { branchId?: string; status?: ResOrderStatus } = {},
  client: PrismaClientLike = prisma
) {
  return client.resOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.branchId ? { branchId: options.branchId } : {}),
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

// Guard for one active order per table: an order not in a terminal state.
export function findActiveOrderForTable(
  tenantId: string,
  branchId: string,
  tableId: string,
  client: PrismaClientLike = prisma
) {
  return client.resOrder.findFirst({
    where: {
      tenantId,
      branchId,
      tableId,
      deletedAt: null,
      status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOIDED'] },
    },
  })
}

export function createOrder(
  tenantId: string,
  input: ResOrderCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.resOrder.create({
    data: {
      tenantId,
      branchId: input.branchId,
      orderNumber: input.orderNumber,
      tableId: input.tableId ?? null,
      customerId: input.customerId ?? null,
      serviceTypeId: input.serviceTypeId ?? null,
      orderType: input.orderType ?? 'DINE_IN',
      channel: input.channel ?? 'POS',
      guestCount: input.guestCount ?? 1,
      currencyCode: input.currencyCode ?? 'USD',
      warehouseId: input.warehouseId ?? null,
      locationId: input.locationId ?? null,
      openedByProfileId: input.openedByProfileId ?? null,
      notes: input.notes ?? null,
      status: 'DRAFT',
    },
  })
}

export function addItem(
  tenantId: string,
  input: ResOrderItemCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.resOrderItem.create({
    data: {
      tenantId,
      orderId: input.orderId,
      menuItemId: input.menuItemId,
      variantId: input.variantId ?? null,
      productId: input.productId ?? null,
      stationId: input.stationId ?? null,
      name: input.name,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      lineDiscount: input.lineDiscount ?? 0,
      lineTax: input.lineTax ?? 0,
      lineTotal: input.lineTotal,
      specialRequest: input.specialRequest ?? null,
    },
  })
}

export function addItemModifier(
  tenantId: string,
  input: {
    orderItemId: string
    modifierId?: string | null
    name: string
    priceDelta?: string | number
    quantity?: number
  },
  client: PrismaClientLike = prisma
) {
  return client.resOrderItemModifier.create({
    data: {
      tenantId,
      orderItemId: input.orderItemId,
      modifierId: input.modifierId ?? null,
      name: input.name,
      priceDelta: input.priceDelta ?? 0,
      quantity: input.quantity ?? 1,
    },
  })
}

export function listItems(tenantId: string, orderId: string, client: PrismaClientLike = prisma) {
  return client.resOrderItem.findMany({
    where: { tenantId, orderId },
    include: { modifiers: true },
    orderBy: { createdAt: 'asc' },
  })
}

export function addPayment(
  tenantId: string,
  input: {
    orderId: string
    method: ResPaymentMethod
    amount: string | number
    reference?: string | null
    giftCardId?: string | null
    createdByProfileId?: string | null
  },
  client: PrismaClientLike = prisma
) {
  return client.resOrderPayment.create({
    data: {
      tenantId,
      orderId: input.orderId,
      method: input.method,
      amount: input.amount,
      reference: input.reference ?? null,
      giftCardId: input.giftCardId ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      status: 'CAPTURED',
    },
  })
}

export function addCharge(
  tenantId: string,
  input: { orderId: string; kind: ResOrderChargeKind; label: string; amount: string | number; isTaxable?: boolean },
  client: PrismaClientLike = prisma
) {
  return client.resOrderCharge.create({
    data: {
      tenantId,
      orderId: input.orderId,
      kind: input.kind,
      label: input.label,
      amount: input.amount,
      isTaxable: input.isTaxable ?? false,
    },
  })
}

export function addDiscount(
  tenantId: string,
  input: {
    orderId: string
    label: string
    amount: string | number
    promotionId?: string | null
    couponId?: string | null
    reasonId?: string | null
  },
  client: PrismaClientLike = prisma
) {
  return client.resOrderDiscount.create({
    data: {
      tenantId,
      orderId: input.orderId,
      label: input.label,
      amount: input.amount,
      promotionId: input.promotionId ?? null,
      couponId: input.couponId ?? null,
      reasonId: input.reasonId ?? null,
    },
  })
}

export async function updateOrderTotals(
  tenantId: string,
  id: string,
  totals: {
    subtotal: string
    discountTotal: string
    taxTotal: string
    serviceChargeTotal: string
    deliveryFee: string
    tipTotal: string
    roundingTotal: string
    grandTotal: string
  },
  client: PrismaClientLike = prisma
) {
  await client.resOrder.updateMany({ where: { id, tenantId }, data: totals })
}

export async function setStatus(
  tenantId: string,
  id: string,
  status: ResOrderStatus,
  extra: Record<string, unknown> = {},
  client: PrismaClientLike = prisma
) {
  await client.resOrder.updateMany({ where: { id, tenantId }, data: { status, ...extra } })
}

export async function incrementAmountPaid(
  tenantId: string,
  id: string,
  amount: string | number,
  client: PrismaClientLike = prisma
) {
  await client.resOrder.updateMany({
    where: { id, tenantId },
    data: { amountPaid: { increment: amount } },
  })
}

export function appendOrderEvent(
  tenantId: string,
  input: {
    orderId: string
    fromStatus?: ResOrderStatus | null
    toStatus: ResOrderStatus
    actorProfileId?: string | null
    reason?: string | null
    payloadJson?: unknown
  },
  client: PrismaClientLike = prisma
) {
  return client.resOrderEvent.create({
    data: {
      tenantId,
      orderId: input.orderId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      actorProfileId: input.actorProfileId ?? null,
      reason: input.reason ?? null,
      payloadJson: (input.payloadJson ?? undefined) as never,
    },
  })
}
