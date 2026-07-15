import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface BalanceGrain {
  tenantId: string
  productId: string
  variantId?: string | null
  warehouseId: string
  locationId: string
  lotId?: string | null
  serialId?: string | null
}

export interface LockedBalance {
  id: string
  onHand: Prisma.Decimal
  reserved: Prisma.Decimal
  allocated: Prisma.Decimal
  avgUnitCost: Prisma.Decimal
  totalValue: Prisma.Decimal
  version: number
}

// Nullable grain components collapse to the literal '-' surrogate so the unique
// index and lock predicate never rely on SQL NULL semantics (NULLs are distinct).
export function grainKey(id?: string | null): string {
  return id ?? '-'
}

interface RawBalanceRow {
  id: string
  on_hand: string
  reserved: string
  allocated: string
  avg_unit_cost: string
  total_value: string
  version: number
}

// Ensures the balance row for a grain exists, then locks it `FOR UPDATE` and
// returns its current numeric state. The insert-on-conflict makes the row visible
// and lockable even on first movement, and the lock serializes concurrent posters
// on THIS grain only — the core of the oversell guard. Must run inside the
// posting `$transaction`.
export async function ensureAndLockBalance(
  tx: Prisma.TransactionClient,
  grain: BalanceGrain
): Promise<LockedBalance> {
  const variantKey = grainKey(grain.variantId)
  const lotKey = grainKey(grain.lotId)
  const serialKey = grainKey(grain.serialId)

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO stock_balances
      (id, tenant_id, product_id, variant_id, variant_key, warehouse_id,
       location_id, lot_id, lot_key, serial_id, serial_key, updated_at)
    VALUES
      (gen_random_uuid(), ${grain.tenantId}::uuid, ${grain.productId}::uuid,
       ${grain.variantId}::uuid, ${variantKey}, ${grain.warehouseId}::uuid,
       ${grain.locationId}::uuid, ${grain.lotId}::uuid, ${lotKey},
       ${grain.serialId}::uuid, ${serialKey}, now())
    ON CONFLICT (tenant_id, product_id, variant_key, location_id, lot_key, serial_key)
    DO NOTHING
  `)

  const rows = await tx.$queryRaw<Array<RawBalanceRow>>(Prisma.sql`
    SELECT id, on_hand, reserved, allocated, avg_unit_cost, total_value, version
    FROM stock_balances
    WHERE tenant_id = ${grain.tenantId}::uuid
      AND product_id = ${grain.productId}::uuid
      AND variant_key = ${variantKey}
      AND location_id = ${grain.locationId}::uuid
      AND lot_key = ${lotKey}
      AND serial_key = ${serialKey}
    FOR UPDATE
  `)

  if (rows.length === 0) {
    throw new Error('Failed to lock stock balance row.')
  }

  const row = rows[0]

  return {
    id: row.id,
    onHand: new Prisma.Decimal(row.on_hand),
    reserved: new Prisma.Decimal(row.reserved),
    allocated: new Prisma.Decimal(row.allocated),
    avgUnitCost: new Prisma.Decimal(row.avg_unit_cost),
    totalValue: new Prisma.Decimal(row.total_value),
    version: row.version,
  }
}

export interface ListBalanceFilters {
  productId?: string
  warehouseId?: string
  locationId?: string
  onlyNonZero?: boolean
  take?: number
  skip?: number
}

export function listBalances(
  tenantId: string,
  filters: ListBalanceFilters = {},
  client: PrismaClientLike = prisma
) {
  return client.stockBalance.findMany({
    where: {
      tenantId,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.onlyNonZero ? { NOT: { onHand: 0 } } : {}),
    },
    orderBy: [{ productId: 'asc' }, { warehouseId: 'asc' }],
    take: filters.take ?? 100,
    skip: filters.skip ?? 0,
  })
}

// Aggregate on-hand + value for a product across the tenant (dashboard/valuation).
export async function summarizeProductStock(
  tenantId: string,
  productId: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.stockBalance.aggregate({
    where: { tenantId, productId },
    _sum: { onHand: true, reserved: true, allocated: true, totalValue: true },
  })

  return {
    onHand: result._sum.onHand ?? new Prisma.Decimal(0),
    reserved: result._sum.reserved ?? new Prisma.Decimal(0),
    allocated: result._sum.allocated ?? new Prisma.Decimal(0),
    totalValue: result._sum.totalValue ?? new Prisma.Decimal(0),
  }
}
