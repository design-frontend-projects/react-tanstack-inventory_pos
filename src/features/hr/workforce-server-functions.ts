import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as workforceService from '#/server/hr/workforce-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  employeeSkillSchema,
  skillRequirementSchema,
  skillWriteSchema,
  workforcePlanWriteSchema,
  workforceRequirementSchema,
} from '#/features/hr/workforce-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })

const VIEW = 'hr.employee_view'
const MANAGE = 'hr.org_manage'

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

// --- Skills catalog ---------------------------------------------------------

export const listSkillsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return workforceService.listSkills(context, data.tenantId)
  })

export const createSkillServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: skillWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.createSkill(context, data.tenantId, data.input)
  })

export const updateSkillServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: skillWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.updateSkill(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteSkillServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.deleteSkill(context, data.tenantId, data.id)
  })

// --- Employee skills --------------------------------------------------------

export const listEmployeeSkillsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      employeeId: z.string().uuid().optional(),
      skillId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return workforceService.listEmployeeSkills(context, data.tenantId, {
      employeeId: data.employeeId,
      skillId: data.skillId,
    })
  })

export const upsertEmployeeSkillServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: employeeSkillSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.upsertEmployeeSkill(
      context,
      data.tenantId,
      data.input,
    )
  })

export const deleteEmployeeSkillServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.deleteEmployeeSkill(context, data.tenantId, data.id)
  })

// --- Workforce plans --------------------------------------------------------

export const listPlansServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ fiscalYear: z.number().int().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return workforceService.listPlans(context, data.tenantId, {
      fiscalYear: data.fiscalYear,
    })
  })

export const createPlanServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: workforcePlanWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.createPlan(context, data.tenantId, data.input)
  })

export const updatePlanServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: workforcePlanWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.updatePlan(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deletePlanServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.deletePlan(context, data.tenantId, data.id)
  })

// --- Workforce requirements -------------------------------------------------

export const listRequirementsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ planId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return workforceService.listRequirements(
      context,
      data.tenantId,
      data.planId,
    )
  })

export const addRequirementServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: workforceRequirementSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.addRequirement(context, data.tenantId, data.input)
  })

// --- Skill requirements -----------------------------------------------------

export const listSkillRequirementsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ positionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return workforceService.listSkillRequirements(
      context,
      data.tenantId,
      data.positionId,
    )
  })

export const addSkillRequirementServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: skillRequirementSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return workforceService.addSkillRequirement(
      context,
      data.tenantId,
      data.input,
    )
  })
