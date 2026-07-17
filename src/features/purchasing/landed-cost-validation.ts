import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const landedCostChargeSchema = z.object({
  costTypeId: z.string().uuid().nullish(),
  description: z.string().max(500).nullish(),
  amount: decimalInput,
  taxAmount: decimalInput.nullish(),
  supplierId: z.string().uuid().nullish(),
})

export const landedCostCreateSchema = z.object({
  goodsReceiptId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().nullish(),
  supplierInvoiceId: z.string().uuid().nullish(),
  allocationBasis: z
    .enum(['quantity', 'value', 'weight', 'volume', 'manual'])
    .optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: decimalInput.nullish(),
  notes: z.string().max(2000).nullish(),
  charges: z.array(landedCostChargeSchema).min(1),
})

export const landedCostAllocateSchema = z.object({
  manualBasis: z
    .array(
      z.object({
        goodsReceiptLineId: z.string().uuid(),
        basisValue: decimalInput,
      }),
    )
    .optional(),
})

export const landedCostListSchema = z.object({
  statusCode: z.string().max(60).optional(),
  goodsReceiptId: z.string().uuid().optional(),
})
