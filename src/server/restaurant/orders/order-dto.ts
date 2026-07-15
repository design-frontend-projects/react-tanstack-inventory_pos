import type {
  ResOrder,
  ResOrderCharge,
  ResOrderDiscount,
  ResOrderItem,
  ResOrderItemModifier,
  ResOrderPayment,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on order rows for the server-function boundary.

type OrderWithRelations = ResOrder & {
  items?: Array<ResOrderItem & { modifiers?: Array<ResOrderItemModifier> }>
  payments?: Array<ResOrderPayment>
  charges?: Array<ResOrderCharge>
  discounts?: Array<ResOrderDiscount>
}

export function serializeOrder(order: OrderWithRelations) {
  return {
    ...order,
    subtotal: order.subtotal.toString(),
    discountTotal: order.discountTotal.toString(),
    taxTotal: order.taxTotal.toString(),
    serviceChargeTotal: order.serviceChargeTotal.toString(),
    deliveryFee: order.deliveryFee.toString(),
    tipTotal: order.tipTotal.toString(),
    roundingTotal: order.roundingTotal.toString(),
    grandTotal: order.grandTotal.toString(),
    amountPaid: order.amountPaid.toString(),
    items: order.items?.map(serializeOrderItem),
    payments: order.payments?.map(serializeOrderPayment),
    charges: order.charges?.map((c) => ({ ...c, amount: c.amount.toString() })),
    discounts: order.discounts?.map((d) => ({ ...d, amount: d.amount.toString() })),
  }
}

export function serializeOrderItem(
  item: ResOrderItem & { modifiers?: Array<ResOrderItemModifier> }
) {
  return {
    ...item,
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toString(),
    lineDiscount: item.lineDiscount.toString(),
    lineTax: item.lineTax.toString(),
    lineTotal: item.lineTotal.toString(),
    modifiers: item.modifiers?.map((m) => ({ ...m, priceDelta: m.priceDelta.toString() })),
  }
}

export function serializeOrderPayment(payment: ResOrderPayment) {
  return { ...payment, amount: payment.amount.toString() }
}
