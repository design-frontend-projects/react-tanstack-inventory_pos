import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as transferService from '#/server/inventory/documents/stock-transfer-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import { transferCreateSchema } from '#/features/transfers/validation'

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

export const listTransfersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'transfer.view')

    return transferService.listTransfers(context, data.tenantId)
  })

export const getTransferServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'transfer.view')

    return transferService.getTransfer(context, data.tenantId, data.id)
  })

export const createTransferServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: transferCreateSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'transfer.create')

    return transferService.createTransfer(context, data.tenantId, data.input)
  })

export const shipTransferServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'transfer.ship')

    return transferService.shipTransfer(context, data.tenantId, data.id)
  })

export const receiveTransferServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'transfer.receive')

    return transferService.receiveTransfer(context, data.tenantId, data.id)
  })
