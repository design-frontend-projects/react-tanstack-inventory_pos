import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for payroll: salary components, per-employee
// component assignments, pay periods, runs, and the derived payslip details.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- Salary components ------------------------------------------------------

export interface ComponentWriteInput {
  code: string
  name: string
  nameAr?: string | null
  componentType?: string
  calcMethod?: string
  formula?: string | null
  isTaxable?: boolean
  affectsGross?: boolean
  glAccountId?: string | null
  displayOrder?: number
  isActive?: boolean
}

export function listComponents(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrSalaryComponent.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function findComponentById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrSalaryComponent.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createComponent(
  tenantId: string,
  input: ComponentWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrSalaryComponent.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      componentType: input.componentType ?? 'earning',
      calcMethod: input.calcMethod ?? 'fixed',
      formula: input.formula ?? null,
      isTaxable: input.isTaxable ?? true,
      affectsGross: input.affectsGross ?? true,
      glAccountId: input.glAccountId ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateComponent(
  tenantId: string,
  id: string,
  input: Partial<ComponentWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrSalaryComponent.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.componentType !== undefined
        ? { componentType: input.componentType }
        : {}),
      ...(input.calcMethod !== undefined
        ? { calcMethod: input.calcMethod }
        : {}),
      ...(input.formula !== undefined
        ? { formula: input.formula ?? null }
        : {}),
      ...(input.isTaxable !== undefined ? { isTaxable: input.isTaxable } : {}),
      ...(input.affectsGross !== undefined
        ? { affectsGross: input.affectsGross }
        : {}),
      ...(input.glAccountId !== undefined
        ? { glAccountId: input.glAccountId ?? null }
        : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findComponentById(tenantId, id, client)
}

export async function softDeleteComponent(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrSalaryComponent.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })
  return result.count > 0
}

// --- Employee salary components ---------------------------------------------

export function listEmployeeComponents(
  tenantId: string,
  employeeId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeSalaryComponent.findMany({
    where: { tenantId, employeeId, deletedAt: null, isActive: true },
  })
}

export function assignEmployeeComponent(
  tenantId: string,
  input: {
    employeeId: string
    componentId: string
    amount: string | number
    currencyCode?: string
    effectiveFrom: Date
  },
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeSalaryComponent.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      componentId: input.componentId,
      amount: input.amount,
      currencyCode: input.currencyCode ?? 'USD',
      effectiveFrom: input.effectiveFrom,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

// --- Pay periods ------------------------------------------------------------

export interface PeriodWriteInput {
  code: string
  name: string
  periodType?: string
  startDate: Date
  endDate: Date
  payDate?: Date | null
  statusCode?: string
}

export function listPeriods(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollPeriod.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { startDate: 'desc' },
  })
}

export function findPeriodById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollPeriod.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createPeriod(
  tenantId: string,
  input: PeriodWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollPeriod.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      periodType: input.periodType ?? 'monthly',
      startDate: input.startDate,
      endDate: input.endDate,
      payDate: input.payDate ?? null,
      statusCode: input.statusCode ?? 'open',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

// --- Payroll runs -----------------------------------------------------------

export type PayrollRunWithDetails = Prisma.HrPayrollRunGetPayload<{
  include: { details: true }
}>

export function listRuns(tenantId: string, client: PrismaClientLike = prisma) {
  return client.hrPayrollRun.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export function findRunById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollRun.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { details: true },
  })
}

export function createRun(
  tenantId: string,
  input: {
    periodId: string
    runNumber: string
    runType?: string
    companyId?: string | null
    branchId?: string | null
    departmentId?: string | null
    currencyCode?: string
  },
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollRun.create({
    data: {
      tenantId,
      periodId: input.periodId,
      runNumber: input.runNumber,
      runType: input.runType ?? 'regular',
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      statusCode: 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function updateRun(
  tenantId: string,
  id: string,
  data: Prisma.HrPayrollRunUpdateManyMutationInput,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollRun.updateMany({
    where: { id, tenantId, deletedAt: null },
    data,
  })
}

export function clearRunDetails(
  tenantId: string,
  runId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollDetail.deleteMany({
    where: { tenantId, payrollRunId: runId },
  })
}

export function createDetail(
  tenantId: string,
  input: {
    payrollRunId: string
    employeeId: string
    contractId?: string | null
    currencyCode: string
    workedDays: number
    grossPay: number
    totalEarnings: number
    totalDeductions: number
    netPay: number
  },
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollDetail.create({
    data: {
      tenantId,
      payrollRunId: input.payrollRunId,
      employeeId: input.employeeId,
      contractId: input.contractId ?? null,
      currencyCode: input.currencyCode,
      workedDays: input.workedDays,
      grossPay: input.grossPay,
      totalEarnings: input.totalEarnings,
      totalDeductions: input.totalDeductions,
      netPay: input.netPay,
    },
  })
}

export function createComponentDetails(
  tenantId: string,
  payrollDetailId: string,
  lines: Array<{
    componentId?: string | null
    componentCode: string
    componentName: string
    componentType: string
    amount: number
    isTaxable?: boolean
  }>,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollComponentDetail.createMany({
    data: lines.map((line) => ({
      tenantId,
      payrollDetailId,
      componentId: line.componentId ?? null,
      componentCode: line.componentCode,
      componentName: line.componentName,
      componentType: line.componentType,
      amount: line.amount,
      isTaxable: line.isTaxable ?? true,
    })),
  })
}

// Detail rows with their component breakdown, for the payslip view + posting.
export function listRunDetails(
  tenantId: string,
  runId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPayrollDetail.findMany({
    where: { tenantId, payrollRunId: runId },
    orderBy: { createdAt: 'asc' },
  })
}

// --- Calculation inputs (contracts, overtime, loans, benefits) --------------

export function activeContractForEmployee(
  tenantId: string,
  employeeId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeContract.findFirst({
    where: { tenantId, employeeId, deletedAt: null, statusCode: 'active' },
    orderBy: { startDate: 'desc' },
  })
}

export function listApprovedOvertimeInPeriod(
  tenantId: string,
  employeeId: string,
  from: Date,
  to: Date,
  client: PrismaClientLike = prisma,
) {
  return client.hrOvertimeRequest.findMany({
    where: {
      tenantId,
      employeeId,
      statusCode: 'approved',
      overtimeDate: { gte: from, lte: to },
      deletedAt: null,
    },
  })
}

export function listActiveBenefits(
  tenantId: string,
  employeeId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeBenefit.findMany({
    where: {
      tenantId,
      employeeId,
      deletedAt: null,
      isActive: true,
      statusCode: 'active',
      amount: { not: null },
    },
  })
}

export async function listDueInstallmentsForEmployee(
  tenantId: string,
  employeeId: string,
  dueBy: Date,
  client: PrismaClientLike = prisma,
) {
  const loans = await client.hrLoan.findMany({
    where: {
      tenantId,
      employeeId,
      deletedAt: null,
      statusCode: { in: ['approved', 'active'] },
    },
    select: { id: true },
  })
  const loanIds = loans.map((l) => l.id)
  if (loanIds.length === 0) return []
  return client.hrLoanInstallment.findMany({
    where: {
      tenantId,
      loanId: { in: loanIds },
      statusCode: 'pending',
      dueDate: { lte: dueBy },
    },
  })
}

export function markInstallmentsPaid(
  tenantId: string,
  installmentIds: Array<string>,
  payrollRunId: string,
  client: PrismaClientLike = prisma,
) {
  if (installmentIds.length === 0) return Promise.resolve({ count: 0 })
  return client.hrLoanInstallment.updateMany({
    where: { tenantId, id: { in: installmentIds } },
    data: { statusCode: 'paid', paidAt: new Date(), payrollRunId },
  })
}

export function listComponentDefinitionsMap(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrSalaryComponent.findMany({
    where: { tenantId, deletedAt: null },
  })
}

export async function listComponentDetailsForRun(
  tenantId: string,
  runId: string,
  client: PrismaClientLike = prisma,
) {
  // Cross-module refs are bare scalar UUIDs (no relation), so resolve the run's
  // detail ids first, then fetch their component lines.
  const details = await client.hrPayrollDetail.findMany({
    where: { tenantId, payrollRunId: runId },
    select: { id: true },
  })
  const detailIds = details.map((d) => d.id)
  if (detailIds.length === 0) return []
  return client.hrPayrollComponentDetail.findMany({
    where: { tenantId, payrollDetailId: { in: detailIds } },
  })
}
