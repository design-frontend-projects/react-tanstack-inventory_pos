import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as performanceService from '#/server/hr/performance-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  goalProgressSchema,
  goalWriteSchema,
  kpiWriteSchema,
  performanceFiltersSchema,
  reviewWriteSchema,
} from '#/features/hr/performance-validation'

const READ = 'hr.performance_view'
const WRITE = 'hr.performance_manage'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })

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

// --- KPIs -------------------------------------------------------------------

export const listKpisServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return performanceService.listKpis(context, data.tenantId)
  })

export const createKpiServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: kpiWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.createKpi(context, data.tenantId, data.input)
  })

export const updateKpiServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: kpiWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.updateKpi(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteKpiServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.deleteKpi(context, data.tenantId, data.id)
  })

// --- Goals ------------------------------------------------------------------

export const listGoalsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: performanceFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return performanceService.listGoals(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const createGoalServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: goalWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.createGoal(context, data.tenantId, data.input)
  })

export const updateGoalServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: goalWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.updateGoal(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteGoalServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.deleteGoal(context, data.tenantId, data.id)
  })

export const recordGoalProgressServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: goalProgressSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.recordProgress(context, data.tenantId, data.input)
  })

export const listGoalProgressServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ goalId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return performanceService.listProgress(context, data.tenantId, data.goalId)
  })

// --- Reviews ----------------------------------------------------------------

export const listReviewsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: performanceFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return performanceService.listReviews(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const getReviewServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return performanceService.getReview(context, data.tenantId, data.id)
  })

export const createReviewServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: reviewWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.createReview(context, data.tenantId, data.input)
  })

export const updateReviewServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: reviewWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.updateReview(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const finalizeReviewServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ ratingLabel: z.string().max(60).nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, WRITE)
    return performanceService.finalizeReview(
      context,
      data.tenantId,
      data.id,
      data.ratingLabel,
    )
  })
