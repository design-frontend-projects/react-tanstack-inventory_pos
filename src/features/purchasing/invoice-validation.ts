import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const dateInput = z.coerce.date()

// --- Supplier invoices (AP) ---------------------------------------------------

export const invoiceItemSchema = z.object({
  productId: z.string().uuid().nullish(),
  variantId: z.string().uuid().nullish(),
  description: z.string().max(500).nullish(),
  purchaseOrderLineId: z.string().uuid().nullish(),
  goodsReceiptLineId: z.string().uuid().nullish(),
  uomId: z.string().uuid().nullish(),
  quantity: decimalInput,
  unitPrice: decimalInput,
  discountAmount: decimalInput.nullish(),
  taxRateId: z.string().uuid().nullish(),
})

export const invoiceCreateSchema = z.object({
  supplierId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().nullish(),
  supplierInvoiceNumber: z.string().max(120).nullish(),
  invoiceDate: dateInput.nullish(),
  dueDate: dateInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: decimalInput.nullish(),
  freightAmount: decimalInput.nullish(),
  retentionAmount: decimalInput.nullish(),
  withholdingTaxAmount: decimalInput.nullish(),
  notes: z.string().max(2000).nullish(),
  items: z.array(invoiceItemSchema).min(1),
})

export const invoiceFromPoSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  supplierInvoiceNumber: z.string().max(120).nullish(),
  invoiceDate: dateInput.nullish(),
  dueDate: dateInput.nullish(),
  notes: z.string().max(2000).nullish(),
})

export const invoiceListSchema = z.object({
  statusCode: z.string().max(60).optional(),
  matchStatusCode: z.string().max(60).optional(),
  paymentStatusCode: z.string().max(60).optional(),
  supplierId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
})

export const invoicePostSchema = z.object({
  overrideVariance: z.boolean().optional(),
})

// --- Debit-note lines ---------------------------------------------------------

export const debitNoteLineSchema = z.object({
  reasonId: z.string().uuid().nullish(),
  productId: z.string().uuid().nullish(),
  description: z.string().max(500).nullish(),
  quantity: decimalInput.nullish(),
  unitCost: decimalInput.nullish(),
  amount: decimalInput,
  taxAmount: decimalInput.nullish(),
  purchaseReturnId: z.string().uuid().nullish(),
})

export const debitNoteLinesSchema = z.object({
  financialNoteId: z.string().uuid(),
  lines: z.array(debitNoteLineSchema),
})
