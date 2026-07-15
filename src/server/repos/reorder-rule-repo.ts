import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ReorderRuleInput {
  productId: string
  variantId?: string | null
  warehouseId: string
  minStock?: Prisma.Decimal | string | number
  maxStock?: Prisma.Decimal | string | number
  safetyStock?: Prisma.Decimal | string | number
  reorderPoint?: Prisma.Decimal | string | number
  reorderQty?: Prisma.Decimal | string | number
  economicOrderQty?: Prisma.Decimal | string | number | null
  leadTimeDays?: number | null
  preferredSupplierId?: string | null
  isActive?: boolean
  notes?: string | null
}

export function listReorderRules(
  tenantId: string,
  filters: { warehouseId?: string; productId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.reorderRule.findMany({
    where: {
      tenantId,
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: filters.take ?? 200,
  })
}

export function findRule(
  tenantId: string,
  productId: string,
  warehouseId: string,
  client: PrismaClientLike = prisma
) {
  return client.reorderRule.findFirst({ where: { tenantId, productId, warehouseId } })
}

// Upsert by the (tenant, product, warehouse) grain via find-then-write — avoids
// the compound-unique whereUnique alias pitfall.
export async function upsertReorderRule(
  tenantId: string,
  input: ReorderRuleInput,
  client: PrismaClientLike = prisma
) {
  const existing = await findRule(tenantId, input.productId, input.warehouseId, client)

  const data = {
    variantId: input.variantId ?? null,
    minStock: input.minStock ?? 0,
    maxStock: input.maxStock ?? 0,
    safetyStock: input.safetyStock ?? 0,
    reorderPoint: input.reorderPoint ?? 0,
    reorderQty: input.reorderQty ?? 0,
    economicOrderQty: input.economicOrderQty ?? null,
    leadTimeDays: input.leadTimeDays ?? null,
    preferredSupplierId: input.preferredSupplierId ?? null,
    isActive: input.isActive ?? true,
    notes: input.notes ?? null,
  }

  if (existing) {
    return client.reorderRule.update({ where: { id: existing.id }, data })
  }

  return client.reorderRule.create({
    data: {
      tenantId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      ...data,
    },
  })
}

export async function deleteReorderRule(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.reorderRule.deleteMany({ where: { id, tenantId } })

  return result.count > 0
}
