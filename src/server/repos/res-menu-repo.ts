import { prisma } from '#/server/db/client'
import type { ResMenuType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Menus and their (self-nesting) categories.

export interface ResMenuWriteInput {
  branchId?: string | null
  code: string
  name: string
  menuType?: ResMenuType
  startsAt?: Date | null
  endsAt?: Date | null
  displayOrder?: number
  isActive?: boolean
}

export interface ResMenuCategoryWriteInput {
  menuId: string
  parentId?: string | null
  code: string
  name: string
  description?: string | null
  imageUrl?: string | null
  displayOrder?: number
  isActive?: boolean
}

export function findMenuById(tenantId: string, id: string, client: PrismaClientLike = prisma) {
  return client.resMenu.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listMenus(
  tenantId: string,
  options: { branchId?: string | null } = {},
  client: PrismaClientLike = prisma
) {
  return client.resMenu.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(options.branchId !== undefined ? { branchId: options.branchId } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createMenu(
  tenantId: string,
  input: ResMenuWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resMenu.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      menuType: input.menuType ?? 'STANDARD',
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}

export function listCategories(
  tenantId: string,
  menuId: string,
  client: PrismaClientLike = prisma
) {
  return client.resMenuCategory.findMany({
    where: { tenantId, menuId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
}

export function createCategory(
  tenantId: string,
  input: ResMenuCategoryWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resMenuCategory.create({
    data: {
      tenantId,
      menuId: input.menuId,
      parentId: input.parentId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  })
}

export async function softDeleteMenu(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resMenu.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })
  return result.count > 0
}
