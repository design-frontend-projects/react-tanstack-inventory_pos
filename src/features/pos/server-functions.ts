import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as saleService from '#/server/inventory/documents/pos-sale-service'
import * as sessionService from '#/server/inventory/documents/pos-session-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  closeSessionSchema,
  completeSaleSchema,
  openSessionSchema,
  posSaleCreateSchema,
} from '#/features/pos/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId
    ),
    permission
  )
}

const base = z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema })
const withId = base.extend({ id: idSchema })

// --- Sessions ---------------------------------------------------------------

export const openSessionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: openSessionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.session_manage')

    return sessionService.openSession(context, data.tenantId, data.input)
  })

export const closeSessionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: closeSessionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.session_manage')

    return sessionService.closeSession(context, data.tenantId, data.id, data.input)
  })

export const listSessionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.access')

    return sessionService.listSessions(context, data.tenantId)
  })

export const getSessionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.access')

    return sessionService.getSession(context, data.tenantId, data.id)
  })

// --- Sales ------------------------------------------------------------------

export const listPosSalesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.access')

    return saleService.listPosSales(context, data.tenantId)
  })

export const getPosSaleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.access')

    return saleService.getPosSale(context, data.tenantId, data.id)
  })

export const createPosSaleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: posSaleCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.sell')

    return saleService.createPosSale(context, data.tenantId, data.input)
  })

export const completePosSaleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: completeSaleSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.sell')

    return saleService.completePosSale(context, data.tenantId, data.id, data.input.payments)
  })

export const voidPosSaleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'pos.void')

    return saleService.voidPosSale(context, data.tenantId, data.id)
  })
