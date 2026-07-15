import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as warehouseService from '#/server/inventory/warehouse-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  locationWriteSchema,
  warehouseWriteSchema,
} from '#/features/warehouses/validation'

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

export const listWarehousesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.view')

    return warehouseService.listWarehouses(context, data.tenantId)
  })

export const createWarehouseServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: warehouseWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.create')

    return warehouseService.createWarehouse(context, data.tenantId, data.input)
  })

export const updateWarehouseServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: warehouseWriteSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.update')

    return warehouseService.updateWarehouse(context, data.tenantId, data.id, data.input)
  })

export const deleteWarehouseServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.update')

    return warehouseService.deleteWarehouse(context, data.tenantId, data.id)
  })

export const listLocationsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      warehouseId: idSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.view')

    return warehouseService.listLocations(context, data.tenantId, data.warehouseId)
  })

export const createLocationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: locationWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.manage_locations')

    return warehouseService.createLocation(context, data.tenantId, data.input)
  })

export const updateLocationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: locationWriteSchema.omit({ warehouseId: true }).partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.manage_locations')

    return warehouseService.updateLocation(context, data.tenantId, data.id, data.input)
  })

export const deleteLocationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'warehouse.manage_locations')

    return warehouseService.deleteLocation(context, data.tenantId, data.id)
  })
