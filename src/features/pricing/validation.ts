import { z } from 'zod'

export const priceListTypeSchema = z.enum(['SALES', 'PURCHASE'])

const decimalInput = z.union([
  z.number().nonnegative(),
  z.string().regex(/^\d+(\.\d+)?$/),
])

export const priceListWriteSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  currencyCode: z.string().min(3).max(3).optional(),
  type: priceListTypeSchema.optional(),
  validFrom: z.coerce.date().nullish(),
  validTo: z.coerce.date().nullish(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const productPriceWriteSchema = z.object({
  priceListId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  uomId: z.string().uuid(),
  minQty: decimalInput.optional(),
  unitPrice: decimalInput,
  taxIncluded: z.boolean().optional(),
  validFrom: z.coerce.date().nullish(),
  validTo: z.coerce.date().nullish(),
})

export const productPriceFiltersSchema = z.object({
  priceListId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
})

export type PriceListWriteInput = z.infer<typeof priceListWriteSchema>
export type ProductPriceWriteInput = z.infer<typeof productPriceWriteSchema>
export type ProductPriceFilters = z.infer<typeof productPriceFiltersSchema>
