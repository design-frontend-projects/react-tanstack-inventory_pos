import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const dateInput = z.coerce.date()

export const salesOrderLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  locationId: z.string().uuid(),
  uomId: z.string().uuid(),
  orderedQty: decimalInput,
  unitPrice: decimalInput,
  discount: decimalInput.optional(),
  taxAmount: decimalInput.optional(),
})

export const salesOrderCreateSchema = z.object({
  customerId: z.string().uuid().nullish(),
  warehouseId: z.string().uuid(),
  requestedDeliveryDate: dateInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  notes: z.string().max(2000).nullish(),
  priceListId: z.string().uuid().nullish(),
  lines: z.array(salesOrderLineSchema).min(1),
})

export const invoiceFromOrderSchema = z.object({
  salesOrderId: z.string().uuid(),
})

export const invoicePaymentSchema = z.object({
  amount: decimalInput,
})
