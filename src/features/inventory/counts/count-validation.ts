import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const stockCountCreateSchema = z.object({
  warehouseId: z.string().uuid(),
  isCycleCount: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
  // Restricts the generated lines to a product subset (cycle counting).
  productIds: z.array(z.string().uuid()).optional(),
})

export const stockCountEntrySchema = z.object({
  lineId: z.string().uuid(),
  countedQty: decimalInput,
  notes: z.string().max(500).nullish(),
})

export const stockCountRecordSchema = z.object({
  entries: z.array(stockCountEntrySchema).min(1),
})

export type StockCountCreateInput = z.infer<typeof stockCountCreateSchema>
export type StockCountEntryInput = z.infer<typeof stockCountEntrySchema>
