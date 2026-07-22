import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as learningService from '#/server/hr/learning-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  trainingCertificateSchema,
  trainingCompletionSchema,
  trainingCourseWriteSchema,
  trainingEnrollSchema,
  trainingRecordFiltersSchema,
  trainingSessionCreateSchema,
  trainingSessionFiltersSchema,
  trainingSessionStatusSchema,
} from '#/features/hr/learning-validation'

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

// --- Courses ----------------------------------------------------------------

export const listTrainingCoursesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.listCourses(context, data.tenantId)
  })

export const createTrainingCourseServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: trainingCourseWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.createCourse(context, data.tenantId, data.input)
  })

export const updateTrainingCourseServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: trainingCourseWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.updateCourse(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteTrainingCourseServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.deleteCourse(context, data.tenantId, data.id)
  })

// --- Sessions ---------------------------------------------------------------

export const listTrainingSessionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({ filters: trainingSessionFiltersSchema.optional() }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.listSessions(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const createTrainingSessionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: trainingSessionCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.createSession(context, data.tenantId, data.input)
  })

export const updateTrainingSessionStatusServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId.extend({ input: trainingSessionStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.updateSessionStatus(
      context,
      data.tenantId,
      data.id,
      data.input.statusCode,
    )
  })

// --- Records ----------------------------------------------------------------

export const listTrainingRecordsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({ filters: trainingRecordFiltersSchema.optional() }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.listRecords(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const enrollTrainingServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: trainingEnrollSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.enroll(context, data.tenantId, data.input)
  })

export const recordTrainingCompletionServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId.extend({ input: trainingCompletionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.recordCompletion(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

// --- Certificates -----------------------------------------------------------

export const listTrainingCertificatesServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ employeeId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.listCertificates(context, data.tenantId, {
      employeeId: data.employeeId,
    })
  })

export const issueTrainingCertificateServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: trainingCertificateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.training_manage')
    return learningService.issueCertificate(context, data.tenantId, data.input)
  })
