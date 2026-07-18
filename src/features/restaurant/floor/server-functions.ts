import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as floor from '#/server/restaurant/floor/floor-service'
import { broadcastRestaurantEvent } from '#/server/realtime/broadcast'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  diningAreaUpdateSchema,
  floorAssignmentUpsertSchema,
  tableSectionUpdateSchema,
  tableStatusSetSchema,
  tableUpdateSchema,
} from '#/features/restaurant/floor/validation'

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

// Setup (definitions) is shared between settings admins and floor managers;
// live-floor actions belong to the floor permission alone.
const SETUP = ['res.settings.manage', 'res.floor.manage']
const FLOOR = 'res.floor.manage'
const FLOOR_VIEW = ['res.orders.view', 'res.floor.manage']

// --- Dining areas / sections / tables ----------------------------------------

export const updateDiningAreaServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: diningAreaUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, SETUP)
    const result = await floor.updateDiningArea(context, data.tenantId, data.id, data.input)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

export const deleteDiningAreaServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, SETUP)
    const result = await floor.deleteDiningArea(context, data.tenantId, data.id)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

export const updateTableSectionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: tableSectionUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, SETUP)
    const result = await floor.updateTableSection(context, data.tenantId, data.id, data.input)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

export const deleteTableSectionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, SETUP)
    const result = await floor.deleteTableSection(context, data.tenantId, data.id)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

export const updateTableServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: tableUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, SETUP)
    const result = await floor.updateTable(context, data.tenantId, data.id, data.input)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

export const deleteTableServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, SETUP)
    const result = await floor.deleteTable(context, data.tenantId, data.id)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

export const setTableStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ tableId: idSchema, status: tableStatusSetSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, FLOOR)
    const result = await floor.setTableStatus(context, data.tenantId, {
      tableId: data.tableId,
      status: data.status,
    })
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

// --- Staff assignments -------------------------------------------------------

export const listFloorAssignmentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, FLOOR_VIEW)
    return floor.listFloorAssignments(context, data.tenantId, data.branchId)
  })

export const upsertFloorAssignmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: floorAssignmentUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, FLOOR)
    const result = await floor.upsertFloorAssignment(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

export const removeFloorAssignmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, FLOOR)
    const result = await floor.removeFloorAssignment(context, data.tenantId, data.id)
    broadcastRestaurantEvent(data.tenantId, ['floor'])
    return result
  })

// --- Live floor status -------------------------------------------------------

export const getFloorStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, FLOOR_VIEW)
    return floor.getFloorStatus(context, data.tenantId, data.branchId)
  })
