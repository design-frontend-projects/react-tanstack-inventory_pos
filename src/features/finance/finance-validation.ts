import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const dateInput = z.coerce.date()
const currencyCode = z.string().length(3)

// --- Chart of accounts ------------------------------------------------------

export const accountCreateSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  nameAr: z.string().max(200).nullish(),
  description: z.string().max(2000).nullish(),
  parentAccountId: z.string().uuid().nullish(),
  accountTypeCode: z.string().min(1).max(60),
  isControlAccount: z.boolean().optional(),
  controlDomain: z.string().max(40).nullish(),
  allowManualJournal: z.boolean().optional(),
  currencyCode: currencyCode.nullish(),
  cashFlowCategoryId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
})

export const accountUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameAr: z.string().max(200).nullish(),
  description: z.string().max(2000).nullish(),
  allowManualJournal: z.boolean().optional(),
  currencyCode: currencyCode.nullish(),
  cashFlowCategoryId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
})

export const accountListSchema = z.object({
  isActive: z.boolean().optional(),
  accountTypeId: z.string().uuid().optional(),
  search: z.string().max(120).optional(),
})

export const accountMappingUpsertSchema = z.object({
  entityType: z.string().min(1).max(60),
  entityId: z.string().uuid().nullish(),
  entityCode: z.string().max(120).nullish(),
  mappingRole: z.string().min(1).max(60),
  accountId: z.string().uuid(),
})

export const accountMappingListSchema = z.object({
  entityType: z.string().max(60).optional(),
  mappingRole: z.string().max(60).optional(),
})

// --- Fiscal calendar --------------------------------------------------------

export const fiscalYearCreateSchema = z.object({
  code: z.string().min(1).max(40),
  startDate: dateInput,
  periodCount: z.number().int().min(1).max(12).optional(),
  includeAdjustmentPeriod: z.boolean().optional(),
  openFirstPeriod: z.boolean().optional(),
})

export const periodTransitionSchema = z.object({
  periodId: z.string().uuid(),
  toStatus: z.enum(['open', 'closed', 'locked']),
})

export const periodModuleLockSchema = z.object({
  periodId: z.string().uuid(),
  moduleCode: z.string().min(1).max(40),
  locked: z.boolean(),
})

// --- Journal entries --------------------------------------------------------

export const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().max(500).nullish(),
  currencyCode,
  exchangeRate: decimalInput.nullish(),
  debitAmount: decimalInput.optional(),
  creditAmount: decimalInput.optional(),
  partyType: z.enum(['customer', 'supplier', 'employee']).nullish(),
  partyId: z.string().uuid().nullish(),
  costCenterId: z.string().uuid().nullish(),
  projectId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
  warehouseId: z.string().uuid().nullish(),
  taxCodeId: z.string().uuid().nullish(),
})

export const journalEntryCreateSchema = z.object({
  journalTypeCode: z.string().max(60).optional(),
  entryDate: dateInput,
  referenceNumber: z.string().max(120).nullish(),
  memo: z.string().max(2000).nullish(),
  currencyCode: currencyCode.optional(),
  isAdjustment: z.boolean().optional(),
  lines: z.array(journalLineSchema).min(2).max(500),
})

export const journalEntryListSchema = z.object({
  statusCode: z.string().max(40).optional(),
  journalTypeId: z.string().uuid().optional(),
  fiscalPeriodId: z.string().uuid().optional(),
  sourceDocType: z.string().max(60).optional(),
  dateFrom: dateInput.optional(),
  dateTo: dateInput.optional(),
})

export const journalPostSchema = z.object({
  isAdjustment: z.boolean().optional(),
})

export const journalReverseSchema = z.object({
  reversalDate: dateInput.optional(),
  memo: z.string().max(2000).nullish(),
})

export const trialBalanceSchema = z.object({
  fiscalPeriodIds: z.array(z.string().uuid()).min(1).max(14),
})

// --- Settings / bootstrap / currency ---------------------------------------

export const settingsUpdateSchema = z.object({
  baseCurrencyCode: currencyCode.optional(),
  retainedEarningsAccountId: z.string().uuid().nullish(),
  fxRealizedGainAccountId: z.string().uuid().nullish(),
  fxRealizedLossAccountId: z.string().uuid().nullish(),
  fxUnrealizedGainAccountId: z.string().uuid().nullish(),
  fxUnrealizedLossAccountId: z.string().uuid().nullish(),
  roundingAccountId: z.string().uuid().nullish(),
  suspenseAccountId: z.string().uuid().nullish(),
  defaultArControlAccountId: z.string().uuid().nullish(),
  defaultApControlAccountId: z.string().uuid().nullish(),
  grniAccountId: z.string().uuid().nullish(),
  inventoryAccountId: z.string().uuid().nullish(),
  cogsAccountId: z.string().uuid().nullish(),
  salesRevenueAccountId: z.string().uuid().nullish(),
  salesDiscountAccountId: z.string().uuid().nullish(),
  bankClearingAccountId: z.string().uuid().nullish(),
  writeOffAccountId: z.string().uuid().nullish(),
  strictAccountResolution: z.boolean().optional(),
  financeStartDate: dateInput.nullish(),
})

export const bootstrapSchema = z.object({
  baseCurrencyCode: currencyCode.optional(),
  fiscalYearStart: dateInput,
  fiscalYearCode: z.string().max(40).optional(),
  includeAdjustmentPeriod: z.boolean().optional(),
})

export const exchangeRateUpsertSchema = z.object({
  fromCurrencyCode: currencyCode,
  toCurrencyCode: currencyCode,
  rateDate: dateInput,
  rate: decimalInput,
  rateType: z.enum(['spot', 'average', 'closing', 'budget']).optional(),
})

export const exchangeRateListSchema = z.object({
  fromCurrencyCode: currencyCode.optional(),
  toCurrencyCode: currencyCode.optional(),
})

export const postingRuleLineSchema = z.object({
  lineNumber: z.number().int().min(0),
  lineRole: z.string().min(1).max(60),
  side: z.enum(['debit', 'credit']),
  accountSource: z.enum(['fixed', 'mapping', 'settings_default']),
  accountId: z.string().uuid().nullish(),
  mappingEntityType: z.string().max(60).nullish(),
  mappingRole: z.string().max(60).nullish(),
  settingsField: z.string().max(60).nullish(),
  amountSelector: z.string().min(1).max(60),
  multiplier: z.number().int().optional(),
  description: z.string().max(500).nullish(),
})

export const postingRuleUpsertSchema = z.object({
  eventType: z.string().min(1).max(120),
  sourceDocType: z.string().max(60).nullish(),
  journalTypeCode: z.string().max(60).nullish(),
  description: z.string().max(500).nullish(),
  priority: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
  lines: z.array(postingRuleLineSchema).min(2).max(50),
})

export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>
export type AccountCreateInput = z.infer<typeof accountCreateSchema>
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>
