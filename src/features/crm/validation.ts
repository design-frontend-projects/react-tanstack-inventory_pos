import { z } from 'zod'
import { segmentRuleSchema } from '#/server/crm/segment-evaluator'

// Zod schemas for the CRM RPC boundary. Enum literals mirror the Prisma enums
// (UPPER_SNAKE codes); the DB stores their lower_snake @map values.

export const crmLifecycleStatusSchema = z.enum([
  'PROSPECT',
  'ACTIVE',
  'AT_RISK',
  'INACTIVE',
  'BLOCKED',
])

export const crmContactTypeSchema = z.enum([
  'PHONE',
  'EMAIL',
  'SOCIAL',
  'OTHER',
])

export const crmAddressTypeSchema = z.enum([
  'BILLING',
  'SHIPPING',
  'DELIVERY',
  'OTHER',
])

export const crmRelationTypeSchema = z.enum([
  'FAMILY',
  'EMERGENCY',
  'COMPANY_CONTACT',
  'REFERRER',
  'OTHER',
])

export const consentChannelSchema = z.enum([
  'EMAIL',
  'SMS',
  'PUSH',
  'WHATSAPP',
  'PHONE',
])
export const consentPurposeSchema = z.enum([
  'MARKETING',
  'TRANSACTIONAL',
  'SURVEY',
])
export const consentStatusSchema = z.enum(['GRANTED', 'DENIED', 'WITHDRAWN'])

export const crmFieldTypeSchema = z.enum([
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
])

const decimalInput = z.union([
  z.number(),
  z.string().regex(/^-?\d+(\.\d+)?$/, 'Invalid decimal'),
])

export const crmDirectoryFiltersSchema = z.object({
  search: z.string().max(160).optional(),
  lifecycleStatus: crmLifecycleStatusSchema.optional(),
  tagId: z.string().uuid().optional(),
  includeInactive: z.boolean().optional(),
  page: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
})

export type CrmDirectoryFiltersInput = z.infer<typeof crmDirectoryFiltersSchema>

export const profileUpsertSchema = z.object({
  dateOfBirth: z.coerce.date().nullish(),
  anniversaryDate: z.coerce.date().nullish(),
  gender: z.string().max(40).nullish(),
  languageCode: z.string().max(12).nullish(),
  currencyCode: z.string().max(8).nullish(),
  timezone: z.string().max(64).nullish(),
  lifecycleStatus: crmLifecycleStatusSchema.optional(),
  vipLevel: z.number().int().min(0).max(100).optional(),
  classification: z.string().max(80).nullish(),
  isCorporate: z.boolean().optional(),
  companyName: z.string().max(200).nullish(),
  acquisitionChannel: z.string().max(80).nullish(),
  notes: z.string().max(4000).nullish(),
})

export const contactUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  contactType: crmContactTypeSchema,
  label: z.string().max(80).nullish(),
  value: z.string().min(1).max(320),
  isPrimary: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  metaJson: z.record(z.string(), z.unknown()).nullish(),
})

export const addressUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  addressType: crmAddressTypeSchema.optional(),
  label: z.string().max(80).nullish(),
  addressJson: z.record(z.string(), z.unknown()),
  deliveryInstructions: z.string().max(2000).nullish(),
  latitude: decimalInput.nullish(),
  longitude: decimalInput.nullish(),
  isDefault: z.boolean().optional(),
})

export const relationshipUpsertSchema = z.object({
  relatedCustomerId: z.string().uuid().nullish(),
  relatedName: z.string().max(200).nullish(),
  relationType: crmRelationTypeSchema,
  phone: z.string().max(40).nullish(),
  note: z.string().max(2000).nullish(),
})

export const preferenceSetSchema = z.object({
  prefKey: z.string().min(1).max(120),
  valueJson: z.unknown(),
})

export const consentSetSchema = z.object({
  channel: consentChannelSchema,
  purpose: consentPurposeSchema,
  status: consentStatusSchema,
  source: z.string().max(120).nullish(),
  evidenceJson: z.record(z.string(), z.unknown()).nullish(),
})

export const tagUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  color: z.string().max(32).nullish(),
})

export const groupUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .min(1)
    .max(60)
    .regex(
      /^[a-z0-9_-]+$/,
      'Lowercase letters, digits, hyphen, underscore only',
    ),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).nullish(),
})

export const customFieldDefinitionSchema = z.object({
  entityType: z.string().min(1).max(60).optional(),
  fieldKey: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, digits, underscore only'),
  label: z.string().min(1).max(160),
  fieldType: crmFieldTypeSchema,
  optionsJson: z.record(z.string(), z.unknown()).nullish(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export const customFieldValuesSchema = z
  .array(
    z.object({
      definitionId: z.string().uuid(),
      valueJson: z.unknown(),
    }),
  )
  .min(1)
  .max(100)

// --- Loyalty -----------------------------------------------------------------

export const loyaltySettingsSchema = z.object({
  pointsPerCurrencyUnit: decimalInput.optional(),
  redemptionValuePerPoint: decimalInput.optional(),
  minRedeemPoints: z.number().int().min(0).optional(),
  expiryMonths: z.number().int().min(1).max(120).nullish(),
  birthdayBonusPoints: z.number().int().min(0).optional(),
  anniversaryBonusPoints: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const loyaltyTierSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(40)
    .regex(
      /^[a-z0-9_-]+$/,
      'Lowercase letters, digits, hyphen, underscore only',
    ),
  name: z.string().min(1).max(120),
  rank: z.number().int().min(0).max(1000).optional(),
  minLifetimePoints: z.number().int().min(0).optional(),
  minAnnualSpend: decimalInput.nullish(),
  earnMultiplier: decimalInput.optional(),
  benefitsJson: z.record(z.string(), z.unknown()).nullish(),
})

export const loyaltyRuleTypeSchema = z.enum([
  'BASE',
  'CATEGORY_BONUS',
  'PRODUCT_BONUS',
  'BIRTHDAY',
  'ANNIVERSARY',
  'CHANNEL',
])

export const earnRuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  ruleType: loyaltyRuleTypeSchema,
  conditionsJson: z.record(z.string(), z.unknown()).nullish(),
  multiplier: decimalInput.nullish(),
  fixedPoints: z.number().int().min(0).max(1_000_000).nullish(),
  validFrom: z.coerce.date().nullish(),
  validTo: z.coerce.date().nullish(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
})

export const redeemPointsSchema = z.object({
  points: z.number().int().min(1).max(10_000_000),
  refType: z.string().max(60).nullish(),
  refId: z.string().uuid().nullish(),
  note: z.string().max(500).nullish(),
})

export const adjustPointsSchema = z.object({
  points: z
    .number()
    .int()
    .min(-10_000_000)
    .max(10_000_000)
    .refine((value) => value !== 0, 'Adjustment cannot be zero'),
  note: z.string().min(1).max(500),
})

// --- Segmentation ------------------------------------------------------------

export const segmentUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .min(1)
    .max(60)
    .regex(
      /^[a-z0-9_-]+$/,
      'Lowercase letters, digits, hyphen, underscore only',
    ),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).nullish(),
  ruleJson: segmentRuleSchema,
  isActive: z.boolean().optional(),
})
