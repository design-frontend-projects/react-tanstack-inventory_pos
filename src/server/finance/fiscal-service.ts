import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as fiscalRepo from '#/server/repos/fin-fiscal-repo'
import { serializeFiscalYear } from '#/server/finance/finance-dto'
import type { FiscalYearDto } from '#/server/finance/finance-dto'
import {
  generatePeriods,
  yearEndDate,
} from '#/server/finance/period-resolution'
import { assertPodTransition } from '#/server/purchasing/pod-status-service'
import type { CurrentUserContext } from '#/types/auth'

// Fiscal calendar management: year generation, period transitions, module
// locks. Period statuses gate the posting engine (period-resolution.ts).

export interface CreateFiscalYearInput {
  code: string
  startDate: Date
  periodCount?: number
  includeAdjustmentPeriod?: boolean
  openFirstPeriod?: boolean
}

export async function createFiscalYear(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateFiscalYearInput,
): Promise<FiscalYearDto> {
  const periods = generatePeriods(input.startDate, input.periodCount ?? 12, {
    includeAdjustmentPeriod: input.includeAdjustmentPeriod ?? false,
  })
  const endDate = yearEndDate(periods)

  const existingYears = await fiscalRepo.listFiscalYears(tenantId)
  const overlapping = existingYears.find(
    (year) => year.startDate <= endDate && year.endDate >= input.startDate,
  )

  if (overlapping) {
    throw new ConflictError(
      `Fiscal year overlaps existing year ${overlapping.code}.`,
    )
  }

  const year = await prisma.$transaction(async (tx) => {
    const created = await fiscalRepo.createFiscalYear(
      tenantId,
      {
        code: input.code,
        startDate: input.startDate,
        endDate,
        createdBy: context.profileId,
        periods: periods.map((period, index) => ({
          ...period,
          statusCode:
            index === 0 && (input.openFirstPeriod ?? true) ? 'open' : 'future',
        })),
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.fiscal_year_created',
        entityType: 'fin_fiscal_year',
        entityId: created.id,
        newValues: { code: input.code, periodCount: periods.length },
      },
      tx,
    )

    return created
  })

  return serializeFiscalYear(year)
}

export async function listFiscalYears(
  tenantId: string,
): Promise<Array<FiscalYearDto>> {
  const years = await fiscalRepo.listFiscalYears(tenantId)

  return years.map(serializeFiscalYear)
}

const PERIOD_ENTITY = 'fin_fiscal_period'

export async function transitionPeriod(
  context: CurrentUserContext,
  tenantId: string,
  periodId: string,
  toStatus: 'open' | 'closed' | 'locked',
): Promise<void> {
  const period = await fiscalRepo.findPeriodById(tenantId, periodId)

  if (!period) {
    throw new NotFoundError('Fiscal period not found.')
  }

  await assertPodTransition(
    tenantId,
    PERIOD_ENTITY,
    period.statusCode,
    toStatus,
  )

  await prisma.$transaction(async (tx) => {
    await fiscalRepo.updatePeriodStatus(tenantId, periodId, toStatus, tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: `finance.period_${toStatus}`,
        entityType: PERIOD_ENTITY,
        entityId: periodId,
        oldValues: { statusCode: period.statusCode },
        newValues: { statusCode: toStatus },
      },
      tx,
    )
  })
}

export async function setModuleLock(
  context: CurrentUserContext,
  tenantId: string,
  periodId: string,
  moduleCode: string,
  locked: boolean,
): Promise<void> {
  const period = await fiscalRepo.findPeriodById(tenantId, periodId)

  if (!period) {
    throw new NotFoundError('Fiscal period not found.')
  }

  if (locked) {
    await fiscalRepo.upsertModuleLock(
      tenantId,
      periodId,
      moduleCode,
      context.profileId,
    )
  } else {
    await fiscalRepo.removeModuleLock(tenantId, periodId, moduleCode)
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actionKey: locked
      ? 'finance.period_module_locked'
      : 'finance.period_module_unlocked',
    entityType: PERIOD_ENTITY,
    entityId: periodId,
    newValues: { moduleCode, locked },
  })
}
