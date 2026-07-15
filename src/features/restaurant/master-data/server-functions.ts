import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as masterData from '#/server/restaurant/master-data/master-data-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  branchCreateSchema,
  branchMemberUpsertSchema,
  diningAreaCreateSchema,
  issueNumberSchema,
  kitchenStationCreateSchema,
  restaurantCreateSchema,
  serviceChargeRuleCreateSchema,
  serviceTypeCreateSchema,
  tableCreateSchema,
  tableSectionCreateSchema,
  taxConfigCreateSchema,
} from '#/features/restaurant/master-data/validation'

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
const withBranch = base.extend({ branchId: idSchema })

// Master data is managed under the restaurant settings permission; reads use the
// dashboard-view permission so operational roles can populate pickers.
const MANAGE = 'res.settings.manage'
const VIEW = ['res.dashboard.view', 'res.settings.manage']

// --- Restaurants ------------------------------------------------------------

export const listRestaurantsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listRestaurants(context, data.tenantId)
  })

export const createRestaurantServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: restaurantCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createRestaurant(context, data.tenantId, data.input)
  })

export const getRestaurantServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.getRestaurant(context, data.tenantId, data.id)
  })

// --- Branches ---------------------------------------------------------------

export const listBranchesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ restaurantId: idSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listBranches(context, data.tenantId, data.restaurantId)
  })

export const createBranchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: branchCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createBranch(context, data.tenantId, data.input)
  })

export const getBranchServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.getBranch(context, data.tenantId, data.id)
  })

export const upsertBranchMemberServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: branchMemberUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.upsertBranchMember(context, data.tenantId, data.input)
  })

// --- Tables -----------------------------------------------------------------

export const listTablesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withBranch)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listTables(context, data.tenantId, data.branchId)
  })

export const listDiningAreasServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withBranch)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listDiningAreas(context, data.tenantId, data.branchId)
  })

export const createDiningAreaServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: diningAreaCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createDiningArea(context, data.tenantId, data.input)
  })

export const listTableSectionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withBranch)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listTableSections(context, data.tenantId, data.branchId)
  })

export const createTableSectionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: tableSectionCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createTableSection(context, data.tenantId, data.input)
  })

export const createTableServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: tableCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createTable(context, data.tenantId, data.input)
  })

// --- Service types ----------------------------------------------------------

export const listServiceTypesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema.nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listServiceTypes(context, data.tenantId, data.branchId ?? null)
  })

export const createServiceTypeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: serviceTypeCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createServiceType(context, data.tenantId, data.input)
  })

// --- Kitchen stations -------------------------------------------------------

export const listKitchenStationsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withBranch)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listKitchenStations(context, data.tenantId, data.branchId)
  })

export const createKitchenStationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: kitchenStationCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createKitchenStation(context, data.tenantId, data.input)
  })

// --- Tax & service-charge configuration -------------------------------------

export const listTaxConfigsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema.nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listTaxConfigs(context, data.tenantId, data.branchId ?? null)
  })

export const createTaxConfigServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: taxConfigCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createTaxConfig(context, data.tenantId, data.input)
  })

export const listServiceChargeRulesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema.nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listServiceChargeRules(context, data.tenantId, data.branchId ?? null)
  })

export const createServiceChargeRuleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: serviceChargeRuleCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.createServiceChargeRule(context, data.tenantId, data.input)
  })

// --- Number sequences -------------------------------------------------------

export const listSequencesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withBranch)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return masterData.listSequences(context, data.tenantId, data.branchId)
  })

export const issueNumberServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: issueNumberSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return masterData.issueNumber(context, data.tenantId, data.input)
  })
