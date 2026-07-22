import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as budgetService from '#/server/hr/budget-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  budgetActualSchema,
  budgetDepartmentSchema,
  budgetPositionSchema,
  budgetYearWriteSchema,
} from '#/features/hr/budget-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })
const withYear = base.extend({ budgetYearId: z.string().uuid() })

const VIEW = 'hr.analytics_view'
const MANAGE = 'hr.settings_manage'

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

// --- Budget years -----------------------------------------------------------

export const listBudgetYearsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return budgetService.listBudgetYears(context, data.tenantId)
  })

export const createBudgetYearServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: budgetYearWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return budgetService.createBudgetYear(context, data.tenantId, data.input)
  })

export const updateBudgetYearServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: budgetYearWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return budgetService.updateBudgetYear(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteBudgetYearServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return budgetService.deleteBudgetYear(context, data.tenantId, data.id)
  })

// --- Budget departments -----------------------------------------------------

export const listBudgetDepartmentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withYear)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return budgetService.listBudgetDepartments(
      context,
      data.tenantId,
      data.budgetYearId,
    )
  })

export const addBudgetDepartmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: budgetDepartmentSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return budgetService.addBudgetDepartment(context, data.tenantId, data.input)
  })

// --- Budget positions -------------------------------------------------------

export const listBudgetPositionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withYear)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return budgetService.listBudgetPositions(
      context,
      data.tenantId,
      data.budgetYearId,
    )
  })

export const addBudgetPositionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: budgetPositionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return budgetService.addBudgetPosition(context, data.tenantId, data.input)
  })

// --- Budget actuals & variance ----------------------------------------------

export const listBudgetActualsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withYear)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return budgetService.listBudgetActuals(
      context,
      data.tenantId,
      data.budgetYearId,
    )
  })

export const addBudgetActualServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: budgetActualSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return budgetService.addBudgetActual(context, data.tenantId, data.input)
  })

export const getBudgetVarianceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withYear)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return budgetService.getVariance(context, data.tenantId, data.budgetYearId)
  })
