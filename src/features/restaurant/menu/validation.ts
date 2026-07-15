import { z } from 'zod'

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((v) => v.length > 0 && !Number.isNaN(Number(v)), 'Must be a numeric value')

const code = z.string().trim().min(1).max(64)
const name = z.string().trim().min(1).max(200)

export const menuTypeSchema = z.enum([
  'STANDARD',
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SEASONAL',
  'LIMITED_TIME',
])
export const menuVisibilitySchema = z.enum(['VISIBLE', 'HIDDEN', 'STAFF_ONLY'])
export const menuItemStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED'])
export const priceTypeSchema = z.enum([
  'BASE',
  'HAPPY_HOUR',
  'WEEKEND',
  'HOLIDAY',
  'DELIVERY',
  'TAKEAWAY',
  'CHANNEL',
])
export const modifierSelectionSchema = z.enum(['SINGLE', 'MULTI'])
export const comboPricingSchema = z.enum(['FIXED', 'DISCOUNTED', 'COMPONENT_SUM'])
export const crossSellSchema = z.enum(['CROSS_SELL', 'UPSELL', 'RECOMMENDED', 'RELATED'])

export const priceScheduleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  from: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .optional(),
})

export const menuCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  code,
  name,
  menuType: menuTypeSchema.optional(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  displayOrder: z.number().int().min(0).optional(),
})

export const categoryCreateSchema = z.object({
  menuId: z.string().uuid(),
  parentId: z.string().uuid().nullish(),
  code,
  name,
  description: z.string().trim().max(1000).nullish(),
  imageUrl: z.string().trim().url().max(500).nullish(),
  displayOrder: z.number().int().min(0).optional(),
})

export const menuItemCreateSchema = z.object({
  categoryId: z.string().uuid(),
  kitchenStationId: z.string().uuid().nullish(),
  code,
  name,
  description: z.string().trim().max(2000).nullish(),
  basePrice: decimalString,
  prepTimeMinutes: z.number().int().min(0).nullish(),
  calorieCount: z.number().int().min(0).nullish(),
  cookingInstructions: z.string().trim().max(2000).nullish(),
  imageUrl: z.string().trim().url().max(500).nullish(),
  isFeatured: z.boolean().optional(),
  isSeasonal: z.boolean().optional(),
  visibility: menuVisibilitySchema.optional(),
  status: menuItemStatusSchema.optional(),
  displayOrder: z.number().int().min(0).optional(),
})
export const menuItemUpdateSchema = menuItemCreateSchema.partial().omit({ categoryId: true })

export const priceRuleCreateSchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  serviceTypeId: z.string().uuid().nullish(),
  priceType: priceTypeSchema.optional(),
  channel: z.string().trim().max(64).nullish(),
  amount: decimalString,
  scheduleJson: priceScheduleSchema.nullish(),
  priority: z.number().int().optional(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
})

export const variantCreateSchema = z.object({
  menuItemId: z.string().uuid(),
  code,
  name,
  priceDelta: decimalString.optional(),
  productVariantId: z.string().uuid().nullish(),
  isDefault: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export const attachModifierGroupSchema = z.object({
  menuItemId: z.string().uuid(),
  modifierGroupId: z.string().uuid(),
  isRequiredOverride: z.boolean().nullish(),
  minSelectOverride: z.number().int().min(0).nullish(),
  maxSelectOverride: z.number().int().min(0).nullish(),
  displayOrder: z.number().int().min(0).optional(),
})

export const modifierGroupCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  code,
  name,
  selectionType: modifierSelectionSchema.optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(0).nullish(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export const modifierCreateSchema = z.object({
  groupId: z.string().uuid(),
  productId: z.string().uuid().nullish(),
  code,
  name,
  priceDelta: decimalString.optional(),
  isDefault: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export const comboCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  code,
  name,
  description: z.string().trim().max(2000).nullish(),
  pricingType: comboPricingSchema.optional(),
  price: decimalString.nullish(),
})

export const comboComponentCreateSchema = z.object({
  comboId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1).optional(),
  priceDelta: decimalString.nullish(),
  isSwappable: z.boolean().optional(),
  groupLabel: z.string().trim().max(120).nullish(),
  displayOrder: z.number().int().min(0).optional(),
})

export const crossSellCreateSchema = z.object({
  sourceItemId: z.string().uuid(),
  targetItemId: z.string().uuid(),
  relationType: crossSellSchema.optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export const resolvePriceSchema = z.object({
  menuItemId: z.string().uuid(),
  serviceTypeId: z.string().uuid().nullish(),
  channel: z.string().trim().max(64).nullish(),
  at: z.string().datetime().optional(),
})
