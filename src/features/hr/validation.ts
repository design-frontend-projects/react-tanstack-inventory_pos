import { z } from 'zod'

// Zod schemas for the HR server-function inputs. Money fields accept a number or
// numeric string and are passed through to Prisma `Decimal` columns. Date fields
// are coerced from ISO strings sent by the client forms.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const optionalDate = z.coerce.date().nullish()

// --- Organization -----------------------------------------------------------

export const companyWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  nameAr: z.string().max(160).nullish(),
  legalName: z.string().max(200).nullish(),
  registrationNo: z.string().max(80).nullish(),
  taxId: z.string().max(80).nullish(),
  currencyCode: z.string().length(3).optional(),
  baseCountry: z.string().max(80).nullish(),
  email: z.string().email().max(160).nullish().or(z.literal('')),
  phone: z.string().max(40).nullish(),
  addressLine: z.string().max(300).nullish(),
  parentCompanyId: z.string().uuid().nullish(),
  isLegalEntity: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const branchWriteSchema = z.object({
  companyId: z.string().uuid(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  nameAr: z.string().max(160).nullish(),
  branchType: z.string().max(40).optional(),
  costCenterId: z.string().uuid().nullish(),
  warehouseId: z.string().uuid().nullish(),
  managerId: z.string().uuid().nullish(),
  timezone: z.string().max(60).nullish(),
  email: z.string().email().max(160).nullish().or(z.literal('')),
  phone: z.string().max(40).nullish(),
  addressLine: z.string().max(300).nullish(),
  city: z.string().max(80).nullish(),
  country: z.string().max(80).nullish(),
  isActive: z.boolean().optional(),
})

export const departmentWriteSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().nullish(),
  divisionId: z.string().uuid().nullish(),
  parentDepartmentId: z.string().uuid().nullish(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  nameAr: z.string().max(160).nullish(),
  managerId: z.string().uuid().nullish(),
  costCenterId: z.string().uuid().nullish(),
  headcountBudget: z.number().int().min(0).nullish(),
  isActive: z.boolean().optional(),
})

export const positionWriteSchema = z.object({
  code: z.string().min(1).max(32),
  title: z.string().min(1).max(160),
  titleAr: z.string().max(160).nullish(),
  departmentId: z.string().uuid().nullish(),
  jobGradeId: z.string().uuid().nullish(),
  reportsToId: z.string().uuid().nullish(),
  employmentType: z.string().max(40).optional(),
  headcountLimit: z.number().int().min(0).nullish(),
  jobDescription: z.string().max(4000).nullish(),
  isManagerial: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const jobGradeWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  nameAr: z.string().max(160).nullish(),
  gradeLevel: z.number().int().min(1).max(99).optional(),
  minSalary: decimalInput.nullish(),
  midSalary: decimalInput.nullish(),
  maxSalary: decimalInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  annualLeaveDays: z.number().int().min(0).max(365).nullish(),
  isActive: z.boolean().optional(),
})

export const costCenterWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  nameAr: z.string().max(160).nullish(),
  companyId: z.string().uuid().nullish(),
  departmentId: z.string().uuid().nullish(),
  parentId: z.string().uuid().nullish(),
  finCostCenterId: z.string().uuid().nullish(),
  isActive: z.boolean().optional(),
})

// --- Employee ---------------------------------------------------------------

export const employeeCreateSchema = z.object({
  employeeCode: z.string().min(1).max(40),
  profileId: z.string().uuid().nullish(),
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).nullish(),
  lastName: z.string().min(1).max(80),
  firstNameAr: z.string().max(80).nullish(),
  lastNameAr: z.string().max(80).nullish(),
  displayName: z.string().max(160).nullish(),
  gender: z.enum(['male', 'female', 'other']).nullish(),
  dateOfBirth: optionalDate,
  maritalStatus: z.string().max(40).nullish(),
  nationality: z.string().max(80).nullish(),
  religion: z.string().max(80).nullish(),
  bloodGroup: z.string().max(8).nullish(),
  personalEmail: z.string().email().max(160).nullish().or(z.literal('')),
  workEmail: z.string().email().max(160).nullish().or(z.literal('')),
  personalPhone: z.string().max(40).nullish(),
  workPhone: z.string().max(40).nullish(),
  nationalId: z.string().max(60).nullish(),
  passportNo: z.string().max(60).nullish(),
  companyId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
  departmentId: z.string().uuid().nullish(),
  sectionId: z.string().uuid().nullish(),
  positionId: z.string().uuid().nullish(),
  jobGradeId: z.string().uuid().nullish(),
  costCenterId: z.string().uuid().nullish(),
  managerId: z.string().uuid().nullish(),
  employmentType: z
    .enum(['full_time', 'part_time', 'contract', 'temporary', 'intern'])
    .optional(),
  employmentStatus: z
    .enum(['active', 'probation', 'on_leave', 'suspended', 'terminated'])
    .optional(),
  hireDate: optionalDate,
  probationEndDate: optionalDate,
  confirmationDate: optionalDate,
  terminationDate: optionalDate,
  terminationReason: z.string().max(400).nullish(),
  workLocation: z.string().max(120).nullish(),
  isActive: z.boolean().optional(),
})

export const employeeUpdateSchema = employeeCreateSchema.partial()

export const employeeFiltersSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  employmentStatus: z.string().optional(),
  managerId: z.string().uuid().optional(),
  take: z.number().int().min(1).max(500).optional(),
  skip: z.number().int().min(0).optional(),
})

export type CompanyWriteInput = z.infer<typeof companyWriteSchema>
export type BranchWriteInput = z.infer<typeof branchWriteSchema>
export type DepartmentWriteInput = z.infer<typeof departmentWriteSchema>
export type PositionWriteInput = z.infer<typeof positionWriteSchema>
export type JobGradeWriteInput = z.infer<typeof jobGradeWriteSchema>
export type CostCenterWriteInput = z.infer<typeof costCenterWriteSchema>
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>
export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>
