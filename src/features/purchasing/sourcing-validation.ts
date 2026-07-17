import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const dateInput = z.coerce.date()

// --- RFQ ----------------------------------------------------------------------

export const rfqItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  uomId: z.string().uuid(),
  quantity: decimalInput,
  requiredDate: dateInput.nullish(),
  specification: z.string().max(1000).nullish(),
  notes: z.string().max(500).nullish(),
})

export const rfqCreateSchema = z.object({
  title: z.string().max(200).nullish(),
  requisitionId: z.string().uuid().nullish(),
  warehouseId: z.string().uuid().nullish(),
  currencyCode: z.string().length(3).optional(),
  expiryDate: dateInput.nullish(),
  notes: z.string().max(2000).nullish(),
  items: z.array(rfqItemSchema).min(1),
  supplierIds: z.array(z.string().uuid()).min(1),
})

export const rfqReviseSchema = z.object({
  title: z.string().max(200).nullish(),
  expiryDate: dateInput.nullish(),
  notes: z.string().max(2000).nullish(),
  items: z.array(rfqItemSchema).min(1),
})

export const rfqListSchema = z.object({
  statusCode: z.string().max(60).optional(),
  supplierId: z.string().uuid().optional(),
})

export const rfqAwardSchema = z.object({
  quotationId: z.string().uuid(),
})

// --- Supplier quotations --------------------------------------------------------

export const quotationLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  uomId: z.string().uuid(),
  quantity: decimalInput,
  unitPrice: decimalInput,
  discountPct: decimalInput.nullish(),
  discountAmount: decimalInput.nullish(),
  taxRateId: z.string().uuid().nullish(),
  leadTimeDays: z.number().int().min(0).max(3650).nullish(),
  notes: z.string().max(500).nullish(),
})

export const quotationCreateSchema = z.object({
  rfqId: z.string().uuid().nullish(),
  supplierId: z.string().uuid(),
  quotationDate: dateInput.nullish(),
  validUntil: dateInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: decimalInput.nullish(),
  leadTimeDays: z.number().int().min(0).max(3650).nullish(),
  paymentTerms: z.string().max(120).nullish(),
  freightAmount: decimalInput.nullish(),
  insuranceAmount: decimalInput.nullish(),
  remarks: z.string().max(2000).nullish(),
  lines: z.array(quotationLineSchema).min(1),
})

export const quotationListSchema = z.object({
  statusCode: z.string().max(60).optional(),
  supplierId: z.string().uuid().optional(),
  rfqId: z.string().uuid().optional(),
})

export const quotationConvertSchema = z.object({
  warehouseId: z.string().uuid(),
  expectedDate: dateInput.nullish(),
  notes: z.string().max(2000).nullish(),
})
