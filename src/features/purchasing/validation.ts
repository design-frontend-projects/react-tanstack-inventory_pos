import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const dateInput = z.coerce.date()

// --- Requisitions -----------------------------------------------------------

export const requisitionLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  uomId: z.string().uuid(),
  quantity: decimalInput,
  notes: z.string().max(500).nullish(),
})

export const requisitionCreateSchema = z.object({
  warehouseId: z.string().uuid().nullish(),
  notes: z.string().max(2000).nullish(),
  lines: z.array(requisitionLineSchema).min(1),
})

export const requisitionConvertSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
})

// --- Purchase orders --------------------------------------------------------

export const purchaseOrderLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  uomId: z.string().uuid(),
  orderedQty: decimalInput,
  unitCost: decimalInput,
  taxRateId: z.string().uuid().nullish(),
  expectedDate: dateInput.nullish(),
})

export const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  expectedDate: dateInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  notes: z.string().max(2000).nullish(),
  paymentTerms: z.string().max(120).nullish(),
  requisitionId: z.string().uuid().nullish(),
  lines: z.array(purchaseOrderLineSchema).min(1),
})

// --- Goods receipts ---------------------------------------------------------

export const goodsReceiptLineSchema = z.object({
  purchaseOrderLineId: z.string().uuid().nullish(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  toLocationId: z.string().uuid(),
  uomId: z.string().uuid(),
  receivedQty: decimalInput,
  acceptedQty: decimalInput,
  rejectedQty: decimalInput.optional(),
  unitCost: decimalInput,
  lotNumber: z.string().max(120).nullish(),
  expiryDate: dateInput.nullish(),
})

export const goodsReceiptCreateSchema = z.object({
  purchaseOrderId: z.string().uuid().nullish(),
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  supplierDeliveryNote: z.string().max(120).nullish(),
  lines: z.array(goodsReceiptLineSchema).min(1),
})

// --- Purchase returns -------------------------------------------------------

export const purchaseReturnLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  fromLocationId: z.string().uuid(),
  uomId: z.string().uuid(),
  quantity: decimalInput,
  unitCost: decimalInput.nullish(),
  lotId: z.string().uuid().nullish(),
  serialId: z.string().uuid().nullish(),
})

export const purchaseReturnCreateSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().nullish(),
  reason: z.string().max(2000).nullish(),
  lines: z.array(purchaseReturnLineSchema).min(1),
})
