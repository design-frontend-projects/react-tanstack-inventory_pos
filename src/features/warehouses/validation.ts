import { z } from 'zod'

export const warehouseTypeSchema = z.enum([
  'WAREHOUSE',
  'STORE',
  'OUTLET',
  'VIRTUAL',
  'TRANSIT',
  'QUARANTINE',
])

export const locationTypeSchema = z.enum([
  'ZONE',
  'AISLE',
  'RACK',
  'SHELF',
  'BIN',
  'DOCK',
  'STAGING',
])

export const warehouseWriteSchema = z.object({
  code: z.string().min(1).max(48),
  name: z.string().min(1).max(160),
  warehouseType: warehouseTypeSchema.optional(),
  isDefault: z.boolean().optional(),
  allowNegativeStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const locationWriteSchema = z.object({
  warehouseId: z.string().uuid(),
  code: z.string().min(1).max(48),
  name: z.string().min(1).max(160),
  locationType: locationTypeSchema.optional(),
  parentId: z.string().uuid().nullish(),
  isStockable: z.boolean().optional(),
  isPickable: z.boolean().optional(),
  pickSequence: z.number().int().nullish(),
  isActive: z.boolean().optional(),
})
