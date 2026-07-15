import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as recipes from '#/server/restaurant/recipes/recipe-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  recipeApproveSchema,
  recipeComputeCostSchema,
  recipeCreateSchema,
  recipeLineCreateSchema,
  recipeStepCreateSchema,
  recipeVersionCreateSchema,
} from '#/features/restaurant/recipes/validation'

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

const VIEW = ['res.recipe.view', 'res.recipe.manage']
const MANAGE = 'res.recipe.manage'

export const listRecipesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ menuItemId: idSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return recipes.listRecipes(context, data.tenantId, data.menuItemId)
  })

export const getRecipeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ id: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return recipes.getRecipe(context, data.tenantId, data.id)
  })

export const createRecipeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: recipeCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recipes.createRecipe(context, data.tenantId, data.input)
  })

export const addRecipeVersionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: recipeVersionCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recipes.addVersion(context, data.tenantId, data.input)
  })

export const addRecipeLineServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: recipeLineCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recipes.addLine(context, data.tenantId, data.input)
  })

export const addRecipeStepServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: recipeStepCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recipes.addStep(context, data.tenantId, data.input)
  })

export const computeRecipeCostServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: recipeComputeCostSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recipes.computeCost(context, data.tenantId, data.input.versionId)
  })

export const approveRecipeVersionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: recipeApproveSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recipes.approveVersion(context, data.tenantId, data.input)
  })
