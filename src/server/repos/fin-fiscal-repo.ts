import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Fiscal years, periods, and per-module period locks.

const yearInclude = {
  periods: { orderBy: { periodNumber: 'asc' } },
} satisfies Prisma.FinFiscalYearInclude

export type FinFiscalYearWithPeriods = Prisma.FinFiscalYearGetPayload<{
  include: typeof yearInclude
}>

export function findFiscalYearById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<FinFiscalYearWithPeriods | null> {
  return client.finFiscalYear.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: yearInclude,
  })
}

export function listFiscalYears(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.finFiscalYear.findMany({
    where: { tenantId, deletedAt: null },
    include: yearInclude,
    orderBy: { startDate: 'desc' },
  })
}

export interface FiscalPeriodSeed {
  periodNumber: number
  name: string
  startDate: Date
  endDate: Date
  isAdjustmentPeriod?: boolean
  statusCode?: string
}

export function createFiscalYear(
  tenantId: string,
  input: {
    code: string
    startDate: Date
    endDate: Date
    periods: Array<FiscalPeriodSeed>
    createdBy?: string | null
  },
  client: PrismaClientLike = prisma,
): Promise<FinFiscalYearWithPeriods> {
  return client.finFiscalYear.create({
    data: {
      tenantId,
      code: input.code,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      periods: {
        create: input.periods.map((period) => ({
          tenantId,
          periodNumber: period.periodNumber,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          isAdjustmentPeriod: period.isAdjustmentPeriod ?? false,
          statusCode: period.statusCode ?? 'future',
        })),
      },
    },
    include: yearInclude,
  })
}

export function findPeriodById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.finFiscalPeriod.findFirst({
    where: { id, tenantId },
    include: { moduleLocks: true },
  })
}

// The period a date falls into: regular periods win over the adjustment
// period, which is only addressable explicitly by id.
export function findPeriodForDate(
  tenantId: string,
  date: Date,
  client: PrismaClientLike = prisma,
) {
  return client.finFiscalPeriod.findFirst({
    where: {
      tenantId,
      startDate: { lte: date },
      endDate: { gte: date },
      isAdjustmentPeriod: false,
    },
    include: { moduleLocks: true },
    orderBy: { periodNumber: 'asc' },
  })
}

export async function updatePeriodStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finFiscalPeriod.updateMany({
    where: { id, tenantId },
    data: { statusCode },
  })

  return result.count > 0
}

export async function updateFiscalYearStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorProfileId: string | null = null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finFiscalYear.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      updatedBy: actorProfileId,
      ...(statusCode === 'closed'
        ? { closedAt: new Date(), closedByProfileId: actorProfileId }
        : {}),
    },
  })

  return result.count > 0
}

export async function upsertModuleLock(
  tenantId: string,
  fiscalPeriodId: string,
  moduleCode: string,
  lockedByProfileId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.finPeriodModuleLock.upsert({
    where: {
      tenantId_fiscalPeriodId_moduleCode: {
        tenantId,
        fiscalPeriodId,
        moduleCode,
      },
    },
    create: { tenantId, fiscalPeriodId, moduleCode, lockedByProfileId },
    update: { lockedAt: new Date(), lockedByProfileId },
  })
}

export async function removeModuleLock(
  tenantId: string,
  fiscalPeriodId: string,
  moduleCode: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finPeriodModuleLock.deleteMany({
    where: { tenantId, fiscalPeriodId, moduleCode },
  })

  return result.count > 0
}
