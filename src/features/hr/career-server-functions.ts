import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as careerService from '#/server/hr/career-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  careerPathWriteSchema,
  promotionCreateSchema,
  promotionFiltersSchema,
  successorFiltersSchema,
  successorWriteSchema,
} from '#/features/hr/career-validation'

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

// --- Career paths -----------------------------------------------------------

export const listCareerPathsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_view')
    return careerService.listCareerPaths(context, data.tenantId)
  })

export const createCareerPathServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: careerPathWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.createCareerPath(context, data.tenantId, data.input)
  })

export const updateCareerPathServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: careerPathWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.updateCareerPath(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteCareerPathServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.deleteCareerPath(context, data.tenantId, data.id)
  })

// --- Successors -------------------------------------------------------------

export const listSuccessorsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: successorFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_view')
    return careerService.listSuccessors(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const createSuccessorServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: successorWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.createSuccessor(context, data.tenantId, data.input)
  })

export const updateSuccessorServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: successorWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.updateSuccessor(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteSuccessorServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.deleteSuccessor(context, data.tenantId, data.id)
  })

// --- Promotions -------------------------------------------------------------

export const listPromotionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: promotionFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_view')
    return careerService.listPromotions(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const createPromotionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: promotionCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.createPromotion(context, data.tenantId, data.input)
  })

export const approvePromotionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return careerService.approvePromotion(context, data.tenantId, data.id)
  })
