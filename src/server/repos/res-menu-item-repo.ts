import { prisma } from '#/server/db/client'
import type {
  Prisma,
  ResMenuItemStatus,
  ResMenuVisibility,
  ResPriceType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResMenuItemWriteInput {
  categoryId: string
  kitchenStationId?: string | null
  code: string
  name: string
  description?: string | null
  basePrice: string | number
  prepTimeMinutes?: number | null
  calorieCount?: number | null
  nutritionJson?: Prisma.InputJsonValue | null
  cookingInstructions?: string | null
  imageUrl?: string | null
  isFeatured?: boolean
  isSeasonal?: boolean
  visibility?: ResMenuVisibility
  status?: ResMenuItemStatus
  displayOrder?: number
}

export interface ResMenuItemPriceWriteInput {
  menuItemId: string
  variantId?: string | null
  serviceTypeId?: string | null
  priceType?: ResPriceType
  channel?: string | null
  amount: string | number
  scheduleJson?: Prisma.InputJsonValue | null
  priority?: number
  startsAt?: Date | null
  endsAt?: Date | null
  isActive?: boolean
}

export function findMenuItemById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resMenuItem.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listMenuItems(
  tenantId: string,
  options: { categoryId?: string; status?: ResMenuItemStatus } = {},
  client: PrismaClientLike = prisma
) {
  return client.resMenuItem.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createMenuItem(
  tenantId: string,
  input: ResMenuItemWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resMenuItem.create({
    data: {
      tenantId,
      categoryId: input.categoryId,
      kitchenStationId: input.kitchenStationId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description ?? null,
      basePrice: input.basePrice,
      prepTimeMinutes: input.prepTimeMinutes ?? null,
      calorieCount: input.calorieCount ?? null,
      nutritionJson: input.nutritionJson ?? undefined,
      cookingInstructions: input.cookingInstructions ?? null,
      imageUrl: input.imageUrl ?? null,
      isFeatured: input.isFeatured ?? false,
      isSeasonal: input.isSeasonal ?? false,
      visibility: input.visibility ?? 'VISIBLE',
      status: input.status ?? 'ACTIVE',
      displayOrder: input.displayOrder ?? 0,
    },
  })
}

export async function updateMenuItem(
  tenantId: string,
  id: string,
  data: Partial<ResMenuItemWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.resMenuItem.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
      ...(data.kitchenStationId !== undefined
        ? { kitchenStationId: data.kitchenStationId ?? null }
        : {}),
      ...(data.prepTimeMinutes !== undefined
        ? { prepTimeMinutes: data.prepTimeMinutes ?? null }
        : {}),
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
      ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findMenuItemById(tenantId, id, client)
}

export async function softDeleteMenuItem(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resMenuItem.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  })
  return result.count > 0
}

// --- Price rules ------------------------------------------------------------

export function listPriceRules(
  tenantId: string,
  menuItemId: string,
  client: PrismaClientLike = prisma
) {
  return client.resMenuItemPrice.findMany({
    where: { tenantId, menuItemId, isActive: true },
    orderBy: { priority: 'desc' },
  })
}

export function createPriceRule(
  tenantId: string,
  input: ResMenuItemPriceWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resMenuItemPrice.create({
    data: {
      tenantId,
      menuItemId: input.menuItemId,
      variantId: input.variantId ?? null,
      serviceTypeId: input.serviceTypeId ?? null,
      priceType: input.priceType ?? 'BASE',
      channel: input.channel ?? null,
      amount: input.amount,
      scheduleJson: input.scheduleJson ?? undefined,
      priority: input.priority ?? 0,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive ?? true,
    },
  })
}

// --- Variants ---------------------------------------------------------------

export function listVariants(
  tenantId: string,
  menuItemId: string,
  client: PrismaClientLike = prisma
) {
  return client.resMenuItemVariant.findMany({
    where: { tenantId, menuItemId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createVariant(
  tenantId: string,
  input: {
    menuItemId: string
    code: string
    name: string
    priceDelta?: string | number
    productVariantId?: string | null
    isDefault?: boolean
    displayOrder?: number
  },
  client: PrismaClientLike = prisma
) {
  return client.resMenuItemVariant.create({
    data: {
      tenantId,
      menuItemId: input.menuItemId,
      code: input.code.trim(),
      name: input.name.trim(),
      priceDelta: input.priceDelta ?? 0,
      productVariantId: input.productVariantId ?? null,
      isDefault: input.isDefault ?? false,
      displayOrder: input.displayOrder ?? 0,
    },
  })
}

// --- Attaching modifier groups ----------------------------------------------

export function attachModifierGroup(
  tenantId: string,
  input: {
    menuItemId: string
    modifierGroupId: string
    isRequiredOverride?: boolean | null
    minSelectOverride?: number | null
    maxSelectOverride?: number | null
    displayOrder?: number
  },
  client: PrismaClientLike = prisma
) {
  return client.resMenuItemModifierGroup.upsert({
    where: {
      tenantId_menuItemId_modifierGroupId: {
        tenantId,
        menuItemId: input.menuItemId,
        modifierGroupId: input.modifierGroupId,
      },
    },
    create: {
      tenantId,
      menuItemId: input.menuItemId,
      modifierGroupId: input.modifierGroupId,
      isRequiredOverride: input.isRequiredOverride ?? null,
      minSelectOverride: input.minSelectOverride ?? null,
      maxSelectOverride: input.maxSelectOverride ?? null,
      displayOrder: input.displayOrder ?? 0,
    },
    update: {
      isRequiredOverride: input.isRequiredOverride ?? null,
      minSelectOverride: input.minSelectOverride ?? null,
      maxSelectOverride: input.maxSelectOverride ?? null,
      displayOrder: input.displayOrder ?? 0,
    },
  })
}
