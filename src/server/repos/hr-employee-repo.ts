import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for the employee aggregate. Employee changes never
// overwrite audit history — the service records an HrEmployeeHistory row for
// every mutation (see BR-EMP-1). The detail read includes the sub-aggregates the
// profile page renders.

export interface EmployeeListFilters {
  search?: string
  departmentId?: string
  employmentStatus?: string
  managerId?: string
  take?: number
  skip?: number
}

export interface EmployeeWriteInput {
  employeeCode: string
  profileId?: string | null
  firstName: string
  middleName?: string | null
  lastName: string
  firstNameAr?: string | null
  lastNameAr?: string | null
  displayName?: string | null
  gender?: string | null
  dateOfBirth?: Date | null
  maritalStatus?: string | null
  nationality?: string | null
  religion?: string | null
  bloodGroup?: string | null
  personalEmail?: string | null
  workEmail?: string | null
  personalPhone?: string | null
  workPhone?: string | null
  nationalId?: string | null
  passportNo?: string | null
  companyId?: string | null
  branchId?: string | null
  departmentId?: string | null
  sectionId?: string | null
  positionId?: string | null
  jobGradeId?: string | null
  costCenterId?: string | null
  managerId?: string | null
  employmentType?: string
  employmentStatus?: string
  hireDate?: Date | null
  probationEndDate?: Date | null
  confirmationDate?: Date | null
  terminationDate?: Date | null
  terminationReason?: string | null
  workLocation?: string | null
  isActive?: boolean
}

const employeeDetailInclude = {
  contacts: true,
  addresses: true,
  documents: { orderBy: { createdAt: 'desc' } },
  bankAccounts: true,
  contracts: { orderBy: { startDate: 'desc' } },
  history: { orderBy: { effectiveDate: 'desc' }, take: 200 },
  dependents: true,
  education: true,
  experience: { orderBy: { startDate: 'desc' } },
  certifications: true,
  languages: true,
} satisfies Prisma.HrEmployeeInclude

export type EmployeeWithRelations = Prisma.HrEmployeeGetPayload<{
  include: typeof employeeDetailInclude
}>

function buildWhere(
  tenantId: string,
  filters: EmployeeListFilters,
): Prisma.HrEmployeeWhereInput {
  const where: Prisma.HrEmployeeWhereInput = { tenantId, deletedAt: null }

  if (filters.departmentId) {
    where.departmentId = filters.departmentId
  }
  if (filters.employmentStatus) {
    where.employmentStatus = filters.employmentStatus
  }
  if (filters.managerId) {
    where.managerId = filters.managerId
  }
  if (filters.search) {
    const term = filters.search.trim()
    where.OR = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { employeeCode: { contains: term, mode: 'insensitive' } },
      { workEmail: { contains: term, mode: 'insensitive' } },
    ]
  }

  return where
}

export function listEmployees(
  tenantId: string,
  filters: EmployeeListFilters = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployee.findMany({
    where: buildWhere(tenantId, filters),
    orderBy: [{ employeeCode: 'asc' }],
    take: filters.take ?? 200,
    skip: filters.skip ?? 0,
  })
}

export function countEmployees(
  tenantId: string,
  filters: EmployeeListFilters = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployee.count({ where: buildWhere(tenantId, filters) })
}

export function findEmployeeById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployee.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: employeeDetailInclude,
  })
}

export function findEmployeeSummaryById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployee.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createEmployee(
  tenantId: string,
  input: EmployeeWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployee.create({
    data: {
      tenantId,
      employeeCode: input.employeeCode.trim(),
      profileId: input.profileId ?? null,
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim() ?? null,
      lastName: input.lastName.trim(),
      firstNameAr: input.firstNameAr?.trim() ?? null,
      lastNameAr: input.lastNameAr?.trim() ?? null,
      displayName: input.displayName?.trim() ?? null,
      gender: input.gender ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      maritalStatus: input.maritalStatus ?? null,
      nationality: input.nationality ?? null,
      religion: input.religion ?? null,
      bloodGroup: input.bloodGroup ?? null,
      personalEmail: input.personalEmail ?? null,
      workEmail: input.workEmail ?? null,
      personalPhone: input.personalPhone ?? null,
      workPhone: input.workPhone ?? null,
      nationalId: input.nationalId ?? null,
      passportNo: input.passportNo ?? null,
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      sectionId: input.sectionId ?? null,
      positionId: input.positionId ?? null,
      jobGradeId: input.jobGradeId ?? null,
      costCenterId: input.costCenterId ?? null,
      managerId: input.managerId ?? null,
      employmentType: input.employmentType ?? 'full_time',
      employmentStatus: input.employmentStatus ?? 'active',
      hireDate: input.hireDate ?? null,
      probationEndDate: input.probationEndDate ?? null,
      confirmationDate: input.confirmationDate ?? null,
      terminationDate: input.terminationDate ?? null,
      terminationReason: input.terminationReason ?? null,
      workLocation: input.workLocation ?? null,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateEmployee(
  tenantId: string,
  id: string,
  input: Partial<EmployeeWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  // Copy every provided (non-undefined) field onto the update payload. Field
  // names map 1:1 to the Prisma column names, so a keyed copy is sufficient.
  const data: Record<string, unknown> = { updatedBy: actorId }
  for (const key of Object.keys(input) as Array<keyof EmployeeWriteInput>) {
    if (input[key] !== undefined) {
      data[key] = input[key]
    }
  }

  const result = await client.hrEmployee.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: data as Prisma.HrEmployeeUpdateManyMutationInput,
  })

  if (result.count === 0) {
    return null
  }

  return findEmployeeSummaryById(tenantId, id, client)
}

export async function softDeleteEmployee(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrEmployee.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      deletedAt: new Date(),
      isActive: false,
      employmentStatus: 'terminated',
      deletedBy: actorId,
    },
  })

  return result.count > 0
}

export interface EmployeeHistoryInput {
  employeeId: string
  changeType: string
  fieldName?: string | null
  oldValue?: string | null
  newValue?: string | null
  effectiveDate?: Date
  reason?: string | null
  reference?: string | null
}

export function appendEmployeeHistory(
  tenantId: string,
  input: EmployeeHistoryInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeHistory.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      changeType: input.changeType,
      fieldName: input.fieldName ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      effectiveDate: input.effectiveDate ?? new Date(),
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      changedBy: actorId,
    },
  })
}

export function listEmployeeHistory(
  tenantId: string,
  employeeId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeHistory.findMany({
    where: { tenantId, employeeId },
    orderBy: { effectiveDate: 'desc' },
    take: 500,
  })
}
