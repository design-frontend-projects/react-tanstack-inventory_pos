import { z } from 'zod'

// Zod schemas for the asset assignment + travel & expense server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const assetWriteSchema = z.object({
  employeeId: z.string().uuid(),
  assetType: z.enum([
    'laptop',
    'desktop',
    'vehicle',
    'phone',
    'uniform',
    'tool',
    'other',
  ]),
  name: z.string().min(1).max(160),
  productId: z.string().uuid().nullish(),
  finAssetId: z.string().uuid().nullish(),
  serialNumber: z.string().max(120).nullish(),
  assetTag: z.string().max(60).nullish(),
  assignedDate: z.coerce.date().nullish(),
  conditionOut: z.string().max(200).nullish(),
  value: decimalInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  notes: z.string().max(500).nullish(),
})

export const travelWriteSchema = z.object({
  employeeId: z.string().uuid(),
  purpose: z.string().min(1).max(300),
  destination: z.string().max(160).nullish(),
  travelType: z.enum(['domestic', 'international']).optional(),
  departDate: z.coerce.date().nullish(),
  returnDate: z.coerce.date().nullish(),
  estimatedCost: decimalInput.optional(),
  advanceAmount: decimalInput.optional(),
  currencyCode: z.string().length(3).optional(),
})

export const expenseLineSchema = z.object({
  expenseDate: z.coerce.date().nullish(),
  category: z.string().max(60).optional(),
  description: z.string().max(300).nullish(),
  amount: decimalInput,
  taxAmount: decimalInput.optional(),
  receiptUrl: z.string().max(500).nullish(),
})

export const expenseClaimSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().min(1).max(200),
  travelRequestId: z.string().uuid().nullish(),
  claimDate: z.coerce.date().nullish(),
  currencyCode: z.string().length(3).optional(),
  costCenterId: z.string().uuid().nullish(),
  lines: z.array(expenseLineSchema).min(1),
})

export const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
})

export const reimburseSchema = z.object({
  expenseAccountId: z.string().uuid(),
  payableAccountId: z.string().uuid(),
})

export type AssetWriteInput = z.infer<typeof assetWriteSchema>
export type TravelWriteInput = z.infer<typeof travelWriteSchema>
export type ExpenseClaimInput = z.infer<typeof expenseClaimSchema>
export type ReimburseInput = z.infer<typeof reimburseSchema>
