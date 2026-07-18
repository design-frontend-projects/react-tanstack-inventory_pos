import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const dateInput = z.coerce.date()

export const paymentCreateSchema = z.object({
  supplierId: z.string().uuid(),
  paymentMethodId: z.string().uuid().nullish(),
  paymentDate: dateInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: decimalInput.nullish(),
  amount: decimalInput,
  referenceNumber: z.string().max(120).nullish(),
  bankAccountId: z.string().uuid().nullish(),
  isAdvance: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
})

export const paymentAllocateSchema = z.object({
  allocations: z
    .array(
      z.object({
        supplierInvoiceId: z.string().uuid(),
        amount: decimalInput,
      }),
    )
    .min(1),
})

export const paymentListSchema = z.object({
  statusCode: z.string().max(60).optional(),
  supplierId: z.string().uuid().optional(),
  isAdvance: z.boolean().optional(),
})
