import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for HR budgeting: budget years (the top-level
// container), per-department and per-position budget allocations, and the
// monthly budget-vs-actual ledger used to compute variance. All reads filter
// by tenantId.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- Budget years -----------------------------------------------------------

export interface BudgetYearWriteInput {
  fiscalYear: number
  name: string
  companyId?: string | null
  currencyCode?: string
  totalBudget?: string | number
  statusCode?: string
  isActive?: boolean
}

export function listBudgetYears(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrBudgetYear.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { fiscalYear: 'desc' },
  })
}

export function findBudgetYearById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrBudgetYear.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createBudgetYear(
  tenantId: string,
  input: BudgetYearWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrBudgetYear.create({
    data: {
      tenantId,
      fiscalYear: input.fiscalYear,
      name: input.name.trim(),
      companyId: input.companyId ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      totalBudget: input.totalBudget ?? 0,
      statusCode: input.statusCode ?? 'draft',
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateBudgetYear(
  tenantId: string,
  id: string,
  input: Partial<BudgetYearWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrBudgetYear.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.fiscalYear !== undefined
        ? { fiscalYear: input.fiscalYear }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.companyId !== undefined
        ? { companyId: input.companyId ?? null }
        : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode }
        : {}),
      ...(input.totalBudget !== undefined
        ? { totalBudget: input.totalBudget }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findBudgetYearById(tenantId, id, client)
}

export async function softDeleteBudgetYear(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrBudgetYear.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })
  void actorId
  return result.count > 0
}

// --- Budget departments -----------------------------------------------------

export interface BudgetDepartmentCreateInput {
  budgetYearId: string
  departmentId: string
  budgetType?: string
  budgetAmount?: string | number
  currencyCode?: string
}

export function listBudgetDepartmentsForYear(
  tenantId: string,
  budgetYearId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrBudgetDepartment.findMany({
    where: { tenantId, budgetYearId },
    orderBy: { createdAt: 'asc' },
  })
}

export function createBudgetDepartment(
  tenantId: string,
  input: BudgetDepartmentCreateInput,
  client: PrismaClientLike = prisma,
) {
  return client.hrBudgetDepartment.create({
    data: {
      tenantId,
      budgetYearId: input.budgetYearId,
      departmentId: input.departmentId,
      budgetType: input.budgetType ?? 'salary',
      budgetAmount: input.budgetAmount ?? 0,
      currencyCode: input.currencyCode ?? 'USD',
    },
  })
}

// --- Budget positions -------------------------------------------------------

export interface BudgetPositionCreateInput {
  budgetYearId: string
  positionId: string
  plannedCount?: number
  avgSalary?: string | number
  totalCost?: string | number
  currencyCode?: string
}

export function listBudgetPositionsForYear(
  tenantId: string,
  budgetYearId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrBudgetPosition.findMany({
    where: { tenantId, budgetYearId },
    orderBy: { createdAt: 'asc' },
  })
}

export function createBudgetPosition(
  tenantId: string,
  input: BudgetPositionCreateInput,
  client: PrismaClientLike = prisma,
) {
  const plannedCount = input.plannedCount ?? 0
  const avgSalary = Number(input.avgSalary ?? 0)
  const totalCost = input.totalCost ?? avgSalary * plannedCount
  return client.hrBudgetPosition.create({
    data: {
      tenantId,
      budgetYearId: input.budgetYearId,
      positionId: input.positionId,
      plannedCount,
      avgSalary: input.avgSalary ?? 0,
      totalCost,
      currencyCode: input.currencyCode ?? 'USD',
    },
  })
}

// --- Budget actuals (variance ledger) ---------------------------------------

export interface BudgetActualCreateInput {
  budgetYearId: string
  departmentId?: string | null
  budgetType?: string
  periodMonth: number
  budgetAmount?: string | number
  actualAmount?: string | number
  currencyCode?: string
}

export function listBudgetActualsForYear(
  tenantId: string,
  budgetYearId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrBudgetActual.findMany({
    where: { tenantId, budgetYearId },
    orderBy: [{ periodMonth: 'asc' }, { createdAt: 'asc' }],
  })
}

export function createBudgetActual(
  tenantId: string,
  input: BudgetActualCreateInput,
  client: PrismaClientLike = prisma,
) {
  const budget = Number(input.budgetAmount ?? 0)
  const actual = Number(input.actualAmount ?? 0)
  return client.hrBudgetActual.create({
    data: {
      tenantId,
      budgetYearId: input.budgetYearId,
      departmentId: input.departmentId ?? null,
      budgetType: input.budgetType ?? 'salary',
      periodMonth: input.periodMonth,
      budgetAmount: input.budgetAmount ?? 0,
      actualAmount: input.actualAmount ?? 0,
      varianceAmount: budget - actual,
      currencyCode: input.currencyCode ?? 'USD',
    },
  })
}

// Aggregated budget-vs-actual variance for a year, summed by budget type.
export async function budgetVariance(
  tenantId: string,
  budgetYearId: string,
  client: PrismaClientLike = prisma,
) {
  const rows = await client.hrBudgetActual.groupBy({
    by: ['budgetType'],
    where: { tenantId, budgetYearId },
    _sum: { budgetAmount: true, actualAmount: true, varianceAmount: true },
  })
  return rows.map((row) => ({
    budgetType: row.budgetType,
    budgetAmount: row._sum.budgetAmount?.toString() ?? '0',
    actualAmount: row._sum.actualAmount?.toString() ?? '0',
    varianceAmount: row._sum.varianceAmount?.toString() ?? '0',
  }))
}
