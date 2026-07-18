import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as fiscalService from '#/server/finance/fiscal-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  fiscalYearCreateSchema,
  periodModuleLockSchema,
  periodTransitionSchema,
} from '#/features/finance/finance-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

export const listFiscalYearsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.journal_view')
    return fiscalService.listFiscalYears(data.tenantId)
  })

export const createFiscalYearServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: fiscalYearCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.fiscal_manage')
    return fiscalService.createFiscalYear(context, data.tenantId, data.input)
  })

export const transitionFiscalPeriodServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: periodTransitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.fiscal_manage')
    await fiscalService.transitionPeriod(
      context,
      data.tenantId,
      data.input.periodId,
      data.input.toStatus,
    )
    return { success: true }
  })

export const setPeriodModuleLockServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: periodModuleLockSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.fiscal_manage')
    await fiscalService.setModuleLock(
      context,
      data.tenantId,
      data.input.periodId,
      data.input.moduleCode,
      data.input.locked,
    )
    return { success: true }
  })
