import { z } from 'zod'

// Zod schemas for restaurant master-data server-function inputs (Phase 1).
// Enum literals mirror the Prisma enum member names (UPPER_CASE keys).

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((v) => v.length > 0 && !Number.isNaN(Number(v)), 'Must be a numeric value')

export const restaurantStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
export const branchStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'CLOSED', 'ARCHIVED'])
export const tableStatusSchema = z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED'])
export const serviceKindSchema = z.enum([
  'DINE_IN',
  'TAKEAWAY',
  'PICKUP',
  'DELIVERY',
  'DRIVE_THRU',
  'QR_ORDER',
  'WEBSITE',
  'MOBILE_APP',
  'PHONE',
  'THIRD_PARTY',
])
export const taxAppliesToSchema = z.enum(['ORDER', 'LINE', 'SERVICE_CHARGE', 'DELIVERY'])
export const chargeTypeSchema = z.enum(['PERCENT', 'FIXED'])
export const sequenceTypeSchema = z.enum(['ORDER', 'INVOICE', 'KITCHEN_TICKET', 'RESERVATION'])

const code = z.string().trim().min(1).max(64)
const name = z.string().trim().min(1).max(200)

export const restaurantCreateSchema = z.object({
  code,
  name,
  legalName: z.string().trim().max(200).nullish(),
  brandColor: z.string().trim().max(32).nullish(),
  logoUrl: z.string().trim().url().max(500).nullish(),
  defaultCurrency: z.string().trim().length(3).optional(),
  defaultLocale: z.enum(['en', 'ar']).optional(),
  status: restaurantStatusSchema.optional(),
  isActive: z.boolean().optional(),
})
export const restaurantUpdateSchema = restaurantCreateSchema.partial().omit({ code: true })

export const branchCreateSchema = z.object({
  restaurantId: z.string().uuid(),
  warehouseId: z.string().uuid().nullish(),
  code,
  name,
  addressJson: z.record(z.string(), z.unknown()).nullish(),
  phone: z.string().trim().max(40).nullish(),
  timezone: z.string().trim().max(64).nullish(),
  latitude: decimalString.nullish(),
  longitude: decimalString.nullish(),
  currencyCode: z.string().trim().length(3).optional(),
  isDefault: z.boolean().optional(),
  status: branchStatusSchema.optional(),
  isActive: z.boolean().optional(),
})
export const branchUpdateSchema = branchCreateSchema.partial().omit({ restaurantId: true })

export const diningAreaCreateSchema = z.object({
  branchId: z.string().uuid(),
  code,
  name,
  displayOrder: z.number().int().min(0).optional(),
})

export const tableSectionCreateSchema = z.object({
  branchId: z.string().uuid(),
  diningAreaId: z.string().uuid(),
  code,
  name,
  displayOrder: z.number().int().min(0).optional(),
})

export const tableCreateSchema = z.object({
  branchId: z.string().uuid(),
  sectionId: z.string().uuid(),
  code,
  seats: z.number().int().min(1).max(100).optional(),
  minCapacity: z.number().int().min(1).max(100).nullish(),
  shape: z.string().trim().max(32).nullish(),
  status: tableStatusSchema.optional(),
})
export const tableUpdateSchema = tableCreateSchema
  .partial()
  .omit({ branchId: true, sectionId: true })

export const serviceTypeCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  code,
  name,
  kind: serviceKindSchema.optional(),
  settingsJson: z.record(z.string(), z.unknown()).nullish(),
  displayOrder: z.number().int().min(0).optional(),
})
export const serviceTypeUpdateSchema = serviceTypeCreateSchema.partial().omit({ branchId: true })

export const kitchenStationCreateSchema = z.object({
  branchId: z.string().uuid(),
  code,
  name,
  displayOrder: z.number().int().min(0).optional(),
})
export const kitchenStationUpdateSchema = kitchenStationCreateSchema
  .partial()
  .omit({ branchId: true })

export const taxConfigCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  taxRateId: z.string().uuid().nullish(),
  code,
  name,
  rate: decimalString,
  isInclusive: z.boolean().optional(),
  appliesTo: taxAppliesToSchema.optional(),
})

export const serviceChargeRuleCreateSchema = z.object({
  branchId: z.string().uuid().nullish(),
  code,
  name,
  chargeType: chargeTypeSchema.optional(),
  value: decimalString,
  minGuests: z.number().int().min(0).nullish(),
  appliesToServiceJson: z.record(z.string(), z.unknown()).nullish(),
  isTaxable: z.boolean().optional(),
})

export const branchMemberUpsertSchema = z.object({
  branchId: z.string().uuid(),
  profileId: z.string().uuid(),
  roleCode: z.string().trim().max(64).nullish(),
  isActive: z.boolean().optional(),
})

export const issueNumberSchema = z.object({
  branchId: z.string().uuid(),
  sequenceType: sequenceTypeSchema,
  periodKey: z.string().trim().max(32).optional(),
})

export type RestaurantCreateInput = z.infer<typeof restaurantCreateSchema>
export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type TableCreateInput = z.infer<typeof tableCreateSchema>
export type ServiceTypeCreateInput = z.infer<typeof serviceTypeCreateSchema>
