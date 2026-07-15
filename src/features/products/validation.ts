import { z } from 'zod'

// Shared input schemas for the product catalog + master-data server functions.
// Decimal-typed money/quantity fields accept numbers or numeric strings and are
// passed through to Prisma `Decimal` columns unchanged.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const productTypeSchema = z.enum([
  'SIMPLE',
  'VARIANT',
  'BUNDLE',
  'KIT',
  'SERVICE',
  'COMPOSITE',
])
export const trackingPolicySchema = z.enum(['NONE', 'LOT', 'SERIAL', 'LOT_SERIAL'])
export const costingMethodSchema = z.enum(['WEIGHTED_AVERAGE', 'FIFO', 'STANDARD'])
export const productStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
export const uomTypeSchema = z.enum(['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'TIME'])
export const taxTypeSchema = z.enum(['VAT', 'GST', 'SALES', 'NONE'])
export const customerTypeSchema = z.enum(['RETAIL', 'WHOLESALE', 'B2B'])

export const productCreateSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  slug: z.string().max(200).nullish(),
  description: z.string().max(2000).nullish(),
  productType: productTypeSchema.optional(),
  trackingPolicy: trackingPolicySchema.optional(),
  isStockTracked: z.boolean().optional(),
  hasExpiry: z.boolean().optional(),
  shelfLifeDays: z.number().int().min(0).nullish(),
  categoryId: z.string().uuid().nullish(),
  brandId: z.string().uuid().nullish(),
  baseUomId: z.string().uuid(),
  salesUomId: z.string().uuid().nullish(),
  purchaseUomId: z.string().uuid().nullish(),
  costingMethod: costingMethodSchema.optional(),
  standardCost: decimalInput.nullish(),
  defaultPrice: decimalInput.nullish(),
  taxRateId: z.string().uuid().nullish(),
  barcode: z.string().max(64).nullish(),
  reorderPoint: decimalInput.nullish(),
  reorderQty: decimalInput.nullish(),
  minStock: decimalInput.nullish(),
  maxStock: decimalInput.nullish(),
  safetyStock: decimalInput.nullish(),
  leadTimeDays: z.number().int().min(0).nullish(),
  preferredSupplierId: z.string().uuid().nullish(),
  status: productStatusSchema.optional(),
  isActive: z.boolean().optional(),
})

export const productUpdateSchema = productCreateSchema.partial().extend({
  baseUomId: z.string().uuid().optional(),
})

export const brandWriteSchema = z.object({
  code: z.string().min(1).max(48),
  name: z.string().min(1).max(120),
  logoUrl: z.string().url().nullish(),
  isActive: z.boolean().optional(),
})

export const categoryWriteSchema = z.object({
  code: z.string().min(1).max(48),
  name: z.string().min(1).max(120),
  parentId: z.string().uuid().nullish(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const uomWriteSchema = z.object({
  code: z.string().min(1).max(24),
  name: z.string().min(1).max(80),
  symbol: z.string().max(12).nullish(),
  uomType: uomTypeSchema,
  isBaseUnit: z.boolean().optional(),
  decimalPlaces: z.number().int().min(0).max(8).optional(),
  isActive: z.boolean().optional(),
})

export const supplierWriteSchema = z.object({
  code: z.string().min(1).max(48),
  name: z.string().min(1).max(160),
  taxId: z.string().max(64).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(40).nullish(),
  paymentTerms: z.string().max(120).nullish(),
  currencyCode: z.string().length(3).optional(),
  creditLimit: decimalInput.nullish(),
  isActive: z.boolean().optional(),
})

export const customerWriteSchema = z.object({
  code: z.string().min(1).max(48),
  name: z.string().min(1).max(160),
  customerType: customerTypeSchema.optional(),
  taxId: z.string().max(64).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(40).nullish(),
  priceListId: z.string().uuid().nullish(),
  creditLimit: decimalInput.nullish(),
  isActive: z.boolean().optional(),
})

export const taxRateWriteSchema = z.object({
  code: z.string().min(1).max(48),
  name: z.string().min(1).max(120),
  rate: decimalInput,
  taxType: taxTypeSchema.optional(),
  isCompound: z.boolean().optional(),
  isInclusive: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export type ProductCreateInput = z.infer<typeof productCreateSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
