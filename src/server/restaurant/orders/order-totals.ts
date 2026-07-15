import { Prisma } from '#/server/db/generated/prisma/client'

// Pure order-totals calculator. Given the order's item lines, charges, and
// discounts, it computes the monetary rollup. No DB access — the service loads
// the rows and feeds them in. All arithmetic uses Prisma.Decimal.

export interface TotalsItem {
  quantity: string
  unitPrice: string
  lineDiscount?: string
  lineTax?: string
  modifiersTotal?: string // sum of (modifier priceDelta × quantity) already computed
}

export interface TotalsCharge {
  kind: 'SERVICE_CHARGE' | 'DELIVERY_FEE' | 'PACKAGING' | 'TIP' | 'ROUNDING' | 'OTHER'
  amount: string
}

export interface TotalsDiscount {
  amount: string
}

export interface OrderTotals {
  subtotal: string
  discountTotal: string
  taxTotal: string
  serviceChargeTotal: string
  deliveryFee: string
  tipTotal: string
  roundingTotal: string
  grandTotal: string
}

export function computeLineTotal(item: TotalsItem): string {
  const qty = new Prisma.Decimal(item.quantity)
  const unit = new Prisma.Decimal(item.unitPrice)
  const modifiers = new Prisma.Decimal(item.modifiersTotal ?? 0)
  const discount = new Prisma.Decimal(item.lineDiscount ?? 0)
  const tax = new Prisma.Decimal(item.lineTax ?? 0)
  return qty.times(unit).plus(modifiers).minus(discount).plus(tax).toString()
}

export function computeOrderTotals(
  items: ReadonlyArray<TotalsItem>,
  charges: ReadonlyArray<TotalsCharge> = [],
  discounts: ReadonlyArray<TotalsDiscount> = []
): OrderTotals {
  const zero = new Prisma.Decimal(0)
  let subtotal = zero
  let taxTotal = zero
  let lineDiscountTotal = zero

  for (const item of items) {
    const qty = new Prisma.Decimal(item.quantity)
    const unit = new Prisma.Decimal(item.unitPrice)
    const modifiers = new Prisma.Decimal(item.modifiersTotal ?? 0)
    subtotal = subtotal.plus(qty.times(unit)).plus(modifiers)
    taxTotal = taxTotal.plus(new Prisma.Decimal(item.lineTax ?? 0))
    lineDiscountTotal = lineDiscountTotal.plus(new Prisma.Decimal(item.lineDiscount ?? 0))
  }

  let serviceCharge = zero
  let deliveryFee = zero
  let tip = zero
  let rounding = zero
  for (const charge of charges) {
    const amount = new Prisma.Decimal(charge.amount)
    switch (charge.kind) {
      case 'SERVICE_CHARGE':
      case 'PACKAGING':
      case 'OTHER':
        serviceCharge = serviceCharge.plus(amount)
        break
      case 'DELIVERY_FEE':
        deliveryFee = deliveryFee.plus(amount)
        break
      case 'TIP':
        tip = tip.plus(amount)
        break
      case 'ROUNDING':
        rounding = rounding.plus(amount)
        break
    }
  }

  let orderDiscount = lineDiscountTotal
  for (const discount of discounts) {
    orderDiscount = orderDiscount.plus(new Prisma.Decimal(discount.amount))
  }

  const grandTotal = subtotal
    .minus(orderDiscount)
    .plus(taxTotal)
    .plus(serviceCharge)
    .plus(deliveryFee)
    .plus(tip)
    .plus(rounding)

  return {
    subtotal: subtotal.toString(),
    discountTotal: orderDiscount.toString(),
    taxTotal: taxTotal.toString(),
    serviceChargeTotal: serviceCharge.toString(),
    deliveryFee: deliveryFee.toString(),
    tipTotal: tip.toString(),
    roundingTotal: rounding.toString(),
    grandTotal: grandTotal.toString(),
  }
}
