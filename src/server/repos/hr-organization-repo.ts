import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for the HR organization masters. Every query filters
// by tenantId + deletedAt: null. Mutations trim codes/names and return the
// refreshed row. Cross-module references (warehouseId, finCostCenterId) are bare
// scalar UUIDs — integrity is enforced in the service layer, not by FK.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- Companies --------------------------------------------------------------

export interface CompanyWriteInput {
  code: string
  name: string
  nameAr?: string | null
  legalName?: string | null
  registrationNo?: string | null
  taxId?: string | null
  currencyCode?: string
  baseCountry?: string | null
  email?: string | null
  phone?: string | null
  addressLine?: string | null
  parentCompanyId?: string | null
  isLegalEntity?: boolean
  isActive?: boolean
}

export function listCompanies(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrCompany.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findCompanyById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrCompany.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createCompany(
  tenantId: string,
  input: CompanyWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrCompany.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      legalName: input.legalName?.trim() ?? null,
      registrationNo: input.registrationNo?.trim() ?? null,
      taxId: input.taxId?.trim() ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      baseCountry: input.baseCountry ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      addressLine: input.addressLine ?? null,
      parentCompanyId: input.parentCompanyId ?? null,
      isLegalEntity: input.isLegalEntity ?? true,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateCompany(
  tenantId: string,
  id: string,
  input: Partial<CompanyWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCompany.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.legalName !== undefined
        ? { legalName: input.legalName?.trim() ?? null }
        : {}),
      ...(input.registrationNo !== undefined
        ? { registrationNo: input.registrationNo ?? null }
        : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId ?? null } : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode }
        : {}),
      ...(input.baseCountry !== undefined
        ? { baseCountry: input.baseCountry ?? null }
        : {}),
      ...(input.email !== undefined ? { email: input.email ?? null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
      ...(input.addressLine !== undefined
        ? { addressLine: input.addressLine ?? null }
        : {}),
      ...(input.parentCompanyId !== undefined
        ? { parentCompanyId: input.parentCompanyId ?? null }
        : {}),
      ...(input.isLegalEntity !== undefined
        ? { isLegalEntity: input.isLegalEntity }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })

  if (result.count === 0) {
    return null
  }

  return findCompanyById(tenantId, id, client)
}

export async function softDeleteCompany(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCompany.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })

  return result.count > 0
}

// --- Branches ---------------------------------------------------------------

export interface BranchWriteInput {
  companyId: string
  code: string
  name: string
  nameAr?: string | null
  branchType?: string
  costCenterId?: string | null
  warehouseId?: string | null
  managerId?: string | null
  timezone?: string | null
  email?: string | null
  phone?: string | null
  addressLine?: string | null
  city?: string | null
  country?: string | null
  isActive?: boolean
}

export function listBranches(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrBranch.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findBranchById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrBranch.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function createBranch(
  tenantId: string,
  input: BranchWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrBranch.create({
    data: {
      tenantId,
      companyId: input.companyId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      branchType: input.branchType ?? 'office',
      costCenterId: input.costCenterId ?? null,
      warehouseId: input.warehouseId ?? null,
      managerId: input.managerId ?? null,
      timezone: input.timezone ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      addressLine: input.addressLine ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateBranch(
  tenantId: string,
  id: string,
  input: Partial<BranchWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrBranch.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.branchType !== undefined
        ? { branchType: input.branchType }
        : {}),
      ...(input.costCenterId !== undefined
        ? { costCenterId: input.costCenterId ?? null }
        : {}),
      ...(input.warehouseId !== undefined
        ? { warehouseId: input.warehouseId ?? null }
        : {}),
      ...(input.managerId !== undefined
        ? { managerId: input.managerId ?? null }
        : {}),
      ...(input.timezone !== undefined
        ? { timezone: input.timezone ?? null }
        : {}),
      ...(input.email !== undefined ? { email: input.email ?? null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
      ...(input.addressLine !== undefined
        ? { addressLine: input.addressLine ?? null }
        : {}),
      ...(input.city !== undefined ? { city: input.city ?? null } : {}),
      ...(input.country !== undefined
        ? { country: input.country ?? null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })

  if (result.count === 0) {
    return null
  }

  return findBranchById(tenantId, id, client)
}

export async function softDeleteBranch(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrBranch.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })

  return result.count > 0
}

// --- Departments ------------------------------------------------------------

export interface DepartmentWriteInput {
  companyId: string
  branchId?: string | null
  divisionId?: string | null
  parentDepartmentId?: string | null
  code: string
  name: string
  nameAr?: string | null
  managerId?: string | null
  costCenterId?: string | null
  headcountBudget?: number | null
  isActive?: boolean
}

export function listDepartments(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrDepartment.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: [{ pathText: 'asc' }, { name: 'asc' }],
  })
}

export function findDepartmentById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrDepartment.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createDepartment(
  tenantId: string,
  input: DepartmentWriteInput,
  derived: { depthLevel: number; pathText: string | null },
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrDepartment.create({
    data: {
      tenantId,
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      divisionId: input.divisionId ?? null,
      parentDepartmentId: input.parentDepartmentId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      managerId: input.managerId ?? null,
      costCenterId: input.costCenterId ?? null,
      headcountBudget: input.headcountBudget ?? null,
      depthLevel: derived.depthLevel,
      pathText: derived.pathText,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateDepartment(
  tenantId: string,
  id: string,
  input: Partial<DepartmentWriteInput>,
  derived: { depthLevel?: number; pathText?: string | null },
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrDepartment.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
      ...(input.branchId !== undefined
        ? { branchId: input.branchId ?? null }
        : {}),
      ...(input.divisionId !== undefined
        ? { divisionId: input.divisionId ?? null }
        : {}),
      ...(input.parentDepartmentId !== undefined
        ? { parentDepartmentId: input.parentDepartmentId ?? null }
        : {}),
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.managerId !== undefined
        ? { managerId: input.managerId ?? null }
        : {}),
      ...(input.costCenterId !== undefined
        ? { costCenterId: input.costCenterId ?? null }
        : {}),
      ...(input.headcountBudget !== undefined
        ? { headcountBudget: input.headcountBudget ?? null }
        : {}),
      ...(derived.depthLevel !== undefined
        ? { depthLevel: derived.depthLevel }
        : {}),
      ...(derived.pathText !== undefined ? { pathText: derived.pathText } : {}),
      updatedBy: actorId,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findDepartmentById(tenantId, id, client)
}

export async function softDeleteDepartment(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrDepartment.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })

  return result.count > 0
}

// --- Positions --------------------------------------------------------------

export interface PositionWriteInput {
  code: string
  title: string
  titleAr?: string | null
  departmentId?: string | null
  jobGradeId?: string | null
  reportsToId?: string | null
  employmentType?: string
  headcountLimit?: number | null
  jobDescription?: string | null
  isManagerial?: boolean
  isActive?: boolean
}

export function listPositions(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrPosition.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { title: 'asc' },
  })
}

export function findPositionById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPosition.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createPosition(
  tenantId: string,
  input: PositionWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrPosition.create({
    data: {
      tenantId,
      code: input.code.trim(),
      title: input.title.trim(),
      titleAr: input.titleAr?.trim() ?? null,
      departmentId: input.departmentId ?? null,
      jobGradeId: input.jobGradeId ?? null,
      reportsToId: input.reportsToId ?? null,
      employmentType: input.employmentType ?? 'full_time',
      headcountLimit: input.headcountLimit ?? null,
      jobDescription: input.jobDescription ?? null,
      isManagerial: input.isManagerial ?? false,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updatePosition(
  tenantId: string,
  id: string,
  input: Partial<PositionWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrPosition.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.titleAr !== undefined
        ? { titleAr: input.titleAr?.trim() ?? null }
        : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId ?? null }
        : {}),
      ...(input.jobGradeId !== undefined
        ? { jobGradeId: input.jobGradeId ?? null }
        : {}),
      ...(input.reportsToId !== undefined
        ? { reportsToId: input.reportsToId ?? null }
        : {}),
      ...(input.employmentType !== undefined
        ? { employmentType: input.employmentType }
        : {}),
      ...(input.headcountLimit !== undefined
        ? { headcountLimit: input.headcountLimit ?? null }
        : {}),
      ...(input.jobDescription !== undefined
        ? { jobDescription: input.jobDescription ?? null }
        : {}),
      ...(input.isManagerial !== undefined
        ? { isManagerial: input.isManagerial }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })

  if (result.count === 0) {
    return null
  }

  return findPositionById(tenantId, id, client)
}

export async function softDeletePosition(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrPosition.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })

  return result.count > 0
}

// --- Job grades -------------------------------------------------------------

export interface JobGradeWriteInput {
  code: string
  name: string
  nameAr?: string | null
  gradeLevel?: number
  minSalary?: string | number | null
  midSalary?: string | number | null
  maxSalary?: string | number | null
  currencyCode?: string
  annualLeaveDays?: number | null
  isActive?: boolean
}

export function listJobGrades(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrJobGrade.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { gradeLevel: 'asc' },
  })
}

export function findJobGradeById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobGrade.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createJobGrade(
  tenantId: string,
  input: JobGradeWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobGrade.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      gradeLevel: input.gradeLevel ?? 1,
      minSalary: input.minSalary ?? null,
      midSalary: input.midSalary ?? null,
      maxSalary: input.maxSalary ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      annualLeaveDays: input.annualLeaveDays ?? null,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateJobGrade(
  tenantId: string,
  id: string,
  input: Partial<JobGradeWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrJobGrade.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.gradeLevel !== undefined
        ? { gradeLevel: input.gradeLevel }
        : {}),
      ...(input.minSalary !== undefined
        ? { minSalary: input.minSalary ?? null }
        : {}),
      ...(input.midSalary !== undefined
        ? { midSalary: input.midSalary ?? null }
        : {}),
      ...(input.maxSalary !== undefined
        ? { maxSalary: input.maxSalary ?? null }
        : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode }
        : {}),
      ...(input.annualLeaveDays !== undefined
        ? { annualLeaveDays: input.annualLeaveDays ?? null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })

  if (result.count === 0) {
    return null
  }

  return findJobGradeById(tenantId, id, client)
}

export async function softDeleteJobGrade(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrJobGrade.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })

  return result.count > 0
}

// --- Cost centers -----------------------------------------------------------

export interface CostCenterWriteInput {
  code: string
  name: string
  nameAr?: string | null
  companyId?: string | null
  departmentId?: string | null
  parentId?: string | null
  finCostCenterId?: string | null
  isActive?: boolean
}

export function listCostCenters(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrCostCenter.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { code: 'asc' },
  })
}

export function findCostCenterById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrCostCenter.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createCostCenter(
  tenantId: string,
  input: CostCenterWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrCostCenter.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      companyId: input.companyId ?? null,
      departmentId: input.departmentId ?? null,
      parentId: input.parentId ?? null,
      finCostCenterId: input.finCostCenterId ?? null,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateCostCenter(
  tenantId: string,
  id: string,
  input: Partial<CostCenterWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCostCenter.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.companyId !== undefined
        ? { companyId: input.companyId ?? null }
        : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId ?? null }
        : {}),
      ...(input.parentId !== undefined
        ? { parentId: input.parentId ?? null }
        : {}),
      ...(input.finCostCenterId !== undefined
        ? { finCostCenterId: input.finCostCenterId ?? null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })

  if (result.count === 0) {
    return null
  }

  return findCostCenterById(tenantId, id, client)
}

export async function softDeleteCostCenter(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCostCenter.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })

  return result.count > 0
}
