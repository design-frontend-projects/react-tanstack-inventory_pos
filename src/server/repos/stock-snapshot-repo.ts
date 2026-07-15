import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SnapshotRowInput {
  productId: string
  variantId?: string | null
  warehouseId?: string | null
  onHand: Prisma.Decimal | string | number
  reserved: Prisma.Decimal | string | number
  allocated: Prisma.Decimal | string | number
  avgUnitCost: Prisma.Decimal | string | number
  totalValue: Prisma.Decimal | string | number
}

export async function deleteSnapshotPeriod(
  tenantId: string,
  periodKey: string,
  client: PrismaClientLike = prisma
) {
  await client.stockSnapshot.deleteMany({ where: { tenantId, periodKey } })
}

export async function createSnapshotRows(
  tenantId: string,
  periodKey: string,
  snapshotDate: Date,
  rows: Array<SnapshotRowInput>,
  client: PrismaClientLike = prisma
) {
  if (rows.length === 0) {
    return 0
  }

  const result = await client.stockSnapshot.createMany({
    data: rows.map((row) => ({
      tenantId,
      periodKey,
      snapshotDate,
      productId: row.productId,
      variantId: row.variantId ?? null,
      warehouseId: row.warehouseId ?? null,
      onHand: row.onHand,
      reserved: row.reserved,
      allocated: row.allocated,
      avgUnitCost: row.avgUnitCost,
      totalValue: row.totalValue,
    })),
  })

  return result.count
}

export function listSnapshots(
  tenantId: string,
  filters: { periodKey?: string; productId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.stockSnapshot.findMany({
    where: {
      tenantId,
      ...(filters.periodKey ? { periodKey: filters.periodKey } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: [{ snapshotDate: 'desc' }, { productId: 'asc' }],
    take: filters.take ?? 500,
  })
}
