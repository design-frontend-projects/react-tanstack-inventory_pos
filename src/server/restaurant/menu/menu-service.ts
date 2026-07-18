import { NotFoundError } from '#/server/auth/errors'
import {
  serializeCombo,
  serializeComboComponent,
  serializeMenuItem,
  serializeModifier,
  serializePriceRule,
  serializeVariant,
} from '#/server/restaurant/menu/menu-dto'
import { resolvePrice } from '#/server/restaurant/menu/pricing-resolver'
import type { PriceRuleInput } from '#/server/restaurant/menu/pricing-resolver'
import * as menuRepo from '#/server/repos/res-menu-repo'
import * as itemRepo from '#/server/repos/res-menu-item-repo'
import * as modifierRepo from '#/server/repos/res-modifier-repo'
import * as comboRepo from '#/server/repos/res-combo-repo'
import type { CurrentUserContext } from '#/types/auth'

// --- Menus & categories -----------------------------------------------------

export function listMenus(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null
) {
  return menuRepo.listMenus(tenantId, { branchId })
}

export function createMenu(
  _context: CurrentUserContext,
  tenantId: string,
  input: menuRepo.ResMenuWriteInput
) {
  return menuRepo.createMenu(tenantId, input)
}

export function listCategories(
  _context: CurrentUserContext,
  tenantId: string,
  menuId: string
) {
  return menuRepo.listCategories(tenantId, menuId)
}

export function createCategory(
  _context: CurrentUserContext,
  tenantId: string,
  input: menuRepo.ResMenuCategoryWriteInput
) {
  return menuRepo.createCategory(tenantId, input)
}

// --- Menu items -------------------------------------------------------------

export async function listMenuItems(
  _context: CurrentUserContext,
  tenantId: string,
  categoryId?: string
) {
  const items = await itemRepo.listMenuItems(tenantId, { categoryId })
  return items.map(serializeMenuItem)
}

export async function createMenuItem(
  _context: CurrentUserContext,
  tenantId: string,
  input: itemRepo.ResMenuItemWriteInput
) {
  const created = await itemRepo.createMenuItem(tenantId, input)
  return serializeMenuItem(created)
}

export async function getMenuItem(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const item = await itemRepo.findMenuItemById(tenantId, id)
  if (!item) {
    throw new NotFoundError('Menu item not found')
  }
  return serializeMenuItem(item)
}

export async function addPriceRule(
  _context: CurrentUserContext,
  tenantId: string,
  input: itemRepo.ResMenuItemPriceWriteInput
) {
  const created = await itemRepo.createPriceRule(tenantId, input)
  return serializePriceRule(created)
}

export async function addVariant(
  _context: CurrentUserContext,
  tenantId: string,
  input: Parameters<typeof itemRepo.createVariant>[1]
) {
  const created = await itemRepo.createVariant(tenantId, input)
  return serializeVariant(created)
}

export function attachModifierGroup(
  _context: CurrentUserContext,
  tenantId: string,
  input: Parameters<typeof itemRepo.attachModifierGroup>[1]
) {
  return itemRepo.attachModifierGroup(tenantId, input)
}

// Everything the order-taking screen needs to configure one item: variants plus
// attached modifier groups with per-item overrides resolved and their modifiers.
export async function getItemOrderingDetail(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const item = await itemRepo.findMenuItemById(tenantId, id)
  if (!item) {
    throw new NotFoundError('Menu item not found')
  }

  const [variants, links] = await Promise.all([
    itemRepo.listVariants(tenantId, id),
    itemRepo.listItemModifierGroups(tenantId, id),
  ])

  const groupIds = links.map((link) => link.modifierGroupId)
  const [groups, allModifiers] = await Promise.all([
    modifierRepo.listModifierGroupsByIds(tenantId, groupIds),
    modifierRepo.listModifiersByGroupIds(tenantId, groupIds),
  ])
  const groupsById = new Map(groups.map((group) => [group.id, group]))

  const modifierGroups = links.flatMap((link) => {
    const group = groupsById.get(link.modifierGroupId)
    if (!group) {
      return []
    }

    return [
      {
        groupId: group.id,
        name: group.name,
        selectionType: group.selectionType,
        isRequired: link.isRequiredOverride ?? group.isRequired,
        minSelect: link.minSelectOverride ?? group.minSelect,
        maxSelect: link.maxSelectOverride ?? group.maxSelect,
        displayOrder: link.displayOrder,
        modifiers: allModifiers
          .filter((modifier) => modifier.groupId === group.id)
          .map(serializeModifier),
      },
    ]
  })

  return {
    item: serializeMenuItem(item),
    variants: variants.map(serializeVariant),
    modifierGroups,
  }
}

// Resolve the effective price of a menu item for a service type / channel / time.
export async function resolveItemPrice(
  _context: CurrentUserContext,
  tenantId: string,
  input: { menuItemId: string; serviceTypeId?: string | null; channel?: string | null; at?: string }
) {
  const item = await itemRepo.findMenuItemById(tenantId, input.menuItemId)
  if (!item) {
    throw new NotFoundError('Menu item not found')
  }

  const rules = await itemRepo.listPriceRules(tenantId, input.menuItemId)
  const ruleInputs: Array<PriceRuleInput> = rules.map((rule) => ({
    id: rule.id,
    priceType: rule.priceType,
    amount: rule.amount.toString(),
    serviceTypeId: rule.serviceTypeId,
    channel: rule.channel,
    scheduleJson: (rule.scheduleJson as PriceRuleInput['scheduleJson']) ?? null,
    priority: rule.priority,
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
  }))

  const now = input.at ? new Date(input.at) : new Date()
  const resolved = resolvePrice(item.basePrice.toString(), ruleInputs, {
    serviceTypeId: input.serviceTypeId ?? null,
    channel: input.channel ?? null,
    now,
  })

  return { menuItemId: item.id, ...resolved }
}

// --- Modifier groups & modifiers --------------------------------------------

export function listModifierGroups(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null
) {
  return modifierRepo.listModifierGroups(tenantId, { branchId })
}

export function createModifierGroup(
  _context: CurrentUserContext,
  tenantId: string,
  input: modifierRepo.ResModifierGroupWriteInput
) {
  return modifierRepo.createModifierGroup(tenantId, input)
}

export async function listModifiers(
  _context: CurrentUserContext,
  tenantId: string,
  groupId: string
) {
  const modifiers = await modifierRepo.listModifiers(tenantId, groupId)
  return modifiers.map(serializeModifier)
}

export async function createModifier(
  _context: CurrentUserContext,
  tenantId: string,
  input: modifierRepo.ResModifierWriteInput
) {
  const created = await modifierRepo.createModifier(tenantId, input)
  return serializeModifier(created)
}

// --- Combos & cross-sells ---------------------------------------------------

export async function listCombos(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null
) {
  const combos = await comboRepo.listCombos(tenantId, { branchId })
  return combos.map(serializeCombo)
}

export async function createCombo(
  _context: CurrentUserContext,
  tenantId: string,
  input: comboRepo.ResComboWriteInput
) {
  const created = await comboRepo.createCombo(tenantId, input)
  return serializeCombo(created)
}

export async function addComboComponent(
  _context: CurrentUserContext,
  tenantId: string,
  input: Parameters<typeof comboRepo.addComboComponent>[1]
) {
  const created = await comboRepo.addComboComponent(tenantId, input)
  return serializeComboComponent(created)
}

export function listCrossSells(
  _context: CurrentUserContext,
  tenantId: string,
  sourceItemId: string
) {
  return comboRepo.listCrossSells(tenantId, sourceItemId)
}

export function createCrossSell(
  _context: CurrentUserContext,
  tenantId: string,
  input: Parameters<typeof comboRepo.createCrossSell>[1]
) {
  return comboRepo.createCrossSell(tenantId, input)
}
