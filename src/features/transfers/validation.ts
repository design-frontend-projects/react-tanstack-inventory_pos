import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const transferLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  uomId: z.string().uuid(),
  requestedQty: decimalInput,
  lotId: z.string().uuid().nullish(),
  serialId: z.string().uuid().nullish(),
})

export const transferCreateSchema = z.object({
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  notes: z.string().max(2000).nullish(),
  lines: z.array(transferLineSchema).min(1),
})
