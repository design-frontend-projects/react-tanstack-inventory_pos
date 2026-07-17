import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

// --- Supplier core ----------------------------------------------------------

export const supplierListSchema = z.object({
  search: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  statusCode: z.string().max(60).optional(),
  includeInactive: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
})

export const supplierCreateSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  taxId: z.string().max(60).nullish(),
  email: z.string().email().max(200).nullish(),
  phone: z.string().max(60).nullish(),
  paymentTerms: z.string().max(120).nullish(),
  currencyCode: z.string().length(3).optional(),
  creditLimit: decimalInput.nullish(),
  categoryId: z.string().uuid().nullish(),
  statusCode: z.string().max(60).optional(),
  rating: z
    .union([z.number().min(0).max(5), z.string().regex(/^\d(\.\d{1,2})?$/)])
    .nullish(),
  leadTimeDays: z.number().int().min(0).max(3650).nullish(),
  isPreferred: z.boolean().optional(),
  tags: z.array(z.string().max(60)).nullish(),
  isActive: z.boolean().optional(),
})

export const supplierUpdateSchema = supplierCreateSchema.partial()

// --- Contacts ---------------------------------------------------------------

export const supplierContactSchema = z.object({
  id: z.string().uuid().nullish(),
  supplierId: z.string().uuid(),
  name: z.string().min(1).max(200),
  title: z.string().max(120).nullish(),
  email: z.string().email().max(200).nullish(),
  phone: z.string().max(60).nullish(),
  mobile: z.string().max(60).nullish(),
  isPrimary: z.boolean().optional(),
  notes: z.string().max(1000).nullish(),
  isActive: z.boolean().optional(),
})

// --- Addresses --------------------------------------------------------------

export const supplierAddressSchema = z.object({
  id: z.string().uuid().nullish(),
  supplierId: z.string().uuid(),
  addressType: z.enum(['billing', 'shipping', 'office']).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullish(),
  city: z.string().max(120).nullish(),
  state: z.string().max(120).nullish(),
  postalCode: z.string().max(30).nullish(),
  countryCode: z.string().max(3).nullish(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// --- Bank accounts ----------------------------------------------------------

export const supplierBankSchema = z.object({
  id: z.string().uuid().nullish(),
  supplierId: z.string().uuid(),
  bankName: z.string().min(1).max(200),
  accountName: z.string().max(200).nullish(),
  accountNumber: z.string().max(80).nullish(),
  iban: z.string().max(60).nullish(),
  swift: z.string().max(20).nullish(),
  currencyCode: z.string().length(3).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// --- Categories -------------------------------------------------------------

export const supplierCategorySchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullish(),
  description: z.string().max(1000).nullish(),
  isActive: z.boolean().optional(),
})

export const supplierCategoryUpdateSchema = supplierCategorySchema.partial()
