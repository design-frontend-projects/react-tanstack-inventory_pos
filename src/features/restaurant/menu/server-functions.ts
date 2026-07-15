import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as menu from '#/server/restaurant/menu/menu-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  attachModifierGroupSchema,
  categoryCreateSchema,
  comboComponentCreateSchema,
  comboCreateSchema,
  crossSellCreateSchema,
  menuCreateSchema,
  menuItemCreateSchema,
  modifierCreateSchema,
  modifierGroupCreateSchema,
  priceRuleCreateSchema,
  resolvePriceSchema,
  variantCreateSchema,
} from '#/features/restaurant/menu/validation'

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

const VIEW = ['res.menu.view', 'res.menu.manage']
const MANAGE = 'res.menu.manage'

// --- Menus & categories -----------------------------------------------------

export const listMenusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema.nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.listMenus(context, data.tenantId, data.branchId ?? null)
  })

export const createMenuServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: menuCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.createMenu(context, data.tenantId, data.input)
  })

export const listCategoriesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ menuId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.listCategories(context, data.tenantId, data.menuId)
  })

export const createCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: categoryCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.createCategory(context, data.tenantId, data.input)
  })

// --- Menu items -------------------------------------------------------------

export const listMenuItemsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ categoryId: idSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.listMenuItems(context, data.tenantId, data.categoryId)
  })

export const getMenuItemServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ id: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.getMenuItem(context, data.tenantId, data.id)
  })

export const createMenuItemServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: menuItemCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.createMenuItem(context, data.tenantId, data.input)
  })

export const addPriceRuleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: priceRuleCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.addPriceRule(context, data.tenantId, {
      ...data.input,
      scheduleJson: (data.input.scheduleJson ?? null) as never,
    })
  })

export const addVariantServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: variantCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.addVariant(context, data.tenantId, data.input)
  })

export const attachModifierGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: attachModifierGroupSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.attachModifierGroup(context, data.tenantId, data.input)
  })

export const resolveItemPriceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: resolvePriceSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.resolveItemPrice(context, data.tenantId, data.input)
  })

// --- Modifier groups & modifiers --------------------------------------------

export const listModifierGroupsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema.nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.listModifierGroups(context, data.tenantId, data.branchId ?? null)
  })

export const createModifierGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: modifierGroupCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.createModifierGroup(context, data.tenantId, data.input)
  })

export const listModifiersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ groupId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.listModifiers(context, data.tenantId, data.groupId)
  })

export const createModifierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: modifierCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.createModifier(context, data.tenantId, data.input)
  })

// --- Combos & cross-sells ---------------------------------------------------

export const listCombosServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema.nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.listCombos(context, data.tenantId, data.branchId ?? null)
  })

export const createComboServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: comboCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.createCombo(context, data.tenantId, data.input)
  })

export const addComboComponentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: comboComponentCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.addComboComponent(context, data.tenantId, data.input)
  })

export const listCrossSellsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ sourceItemId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return menu.listCrossSells(context, data.tenantId, data.sourceItemId)
  })

export const createCrossSellServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: crossSellCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return menu.createCrossSell(context, data.tenantId, data.input)
  })
