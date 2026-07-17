import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import * as productRepo from '#/server/repos/product-repo'
import type { CurrentUserContext } from '#/types/auth'

// Read-only aggregations for the inventory dashboards. Sources are the
// materialized stock_balances projection and the immutable movement ledger, so
// everything here is tenant-scoped SELECTs — no writes, no locks. Decimal
// aggregates cross the wire as strings (see catalog-dto.ts for the rationale).

const ZERO = new Prisma.Decimal(0)

// Reservation buckets move soft holds, not physical stock — exclude them from
// in/out flow so the trend reflects real receipts and issues.
const NON_PHYSICAL_MOVEMENT_TYPES = [
  'RESERVATION',
  'RESERVATION_RELEASE',
  'RESERVATION_CONVERSION',
]

export interface InventoryKpis {
  productCount: number
  activeProductCount: number
  lowStockCount: number
  warehouseCount: number
  totalOnHand: string
  totalValue: string
}

export async function getInventoryKpis(
  _context: CurrentUserContext,
  tenantId: string,
): Promise<InventoryKpis> {
  const [productCount, activeProductCount, warehouseCount, totals, lowRows] =
    await Promise.all([
      productRepo.countProducts(tenantId, {}),
      productRepo.countProducts(tenantId, { status: 'ACTIVE' }),
      prisma.warehouse.count({ where: { tenantId, deletedAt: null } }),
      prisma.stockBalance.aggregate({
        where: { tenantId },
        _sum: { onHand: true, totalValue: true },
      }),
      prisma.$queryRaw<Array<{ low_count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS low_count
        FROM (
          SELECT p.id
          FROM products p
          LEFT JOIN stock_balances sb
            ON sb.tenant_id = p.tenant_id AND sb.product_id = p.id
          WHERE p.tenant_id = ${tenantId}::uuid
            AND p.deleted_at IS NULL
            AND p.reorder_point IS NOT NULL
          GROUP BY p.id, p.reorder_point
          HAVING COALESCE(SUM(sb.on_hand - sb.reserved), 0) < p.reorder_point
        ) low
      `),
    ])

  return {
    productCount,
    activeProductCount,
    lowStockCount: lowRows[0]?.low_count ?? 0,
    warehouseCount,
    totalOnHand: (totals._sum.onHand ?? ZERO).toString(),
    totalValue: (totals._sum.totalValue ?? ZERO).toString(),
  }
}

export interface CategoryStockRow {
  categoryId: string | null
  categoryName: string
  onHand: string
  totalValue: string
}

export async function getStockByCategory(
  _context: CurrentUserContext,
  tenantId: string,
  warehouseId?: string,
): Promise<Array<CategoryStockRow>> {
  const warehouseFilter = warehouseId
    ? Prisma.sql`AND sb.warehouse_id = ${warehouseId}::uuid`
    : Prisma.empty

  const rows = await prisma.$queryRaw<
    Array<{
      category_id: string | null
      category_name: string
      on_hand: string
      total_value: string
    }>
  >(Prisma.sql`
    SELECT
      c.id AS category_id,
      COALESCE(c.name, 'Uncategorized') AS category_name,
      COALESCE(SUM(sb.on_hand), 0)::text AS on_hand,
      COALESCE(SUM(sb.total_value), 0)::text AS total_value
    FROM stock_balances sb
    JOIN products p
      ON p.id = sb.product_id AND p.tenant_id = sb.tenant_id
    LEFT JOIN product_categories c ON c.id = p.category_id
    WHERE sb.tenant_id = ${tenantId}::uuid
      ${warehouseFilter}
    GROUP BY c.id, c.name
    ORDER BY SUM(sb.total_value) DESC NULLS LAST
  `)

  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    onHand: String(row.on_hand),
    totalValue: String(row.total_value),
  }))
}

export interface TopProductRow {
  productId: string
  sku: string
  name: string
  onHand: string
  totalValue: string
}

export async function getTopProductsByValue(
  _context: CurrentUserContext,
  tenantId: string,
  limit = 10,
): Promise<Array<TopProductRow>> {
  const groups = await prisma.stockBalance.groupBy({
    by: ['productId'],
    where: { tenantId },
    _sum: { onHand: true, totalValue: true },
    orderBy: { _sum: { totalValue: 'desc' } },
    take: limit,
  })

  if (groups.length === 0) {
    return []
  }

  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: groups.map((group) => group.productId) } },
    select: { id: true, sku: true, name: true },
  })
  const byId = new Map(products.map((product) => [product.id, product]))

  return groups.map((group) => {
    const product = byId.get(group.productId)

    return {
      productId: group.productId,
      sku: product?.sku ?? '—',
      name: product?.name ?? 'Unknown product',
      onHand: (group._sum.onHand ?? ZERO).toString(),
      totalValue: (group._sum.totalValue ?? ZERO).toString(),
    }
  })
}

export interface MovementTrendPoint {
  day: string
  inQty: string
  outQty: string
  inValue: string
  outValue: string
}

export async function getMovementTrend(
  _context: CurrentUserContext,
  tenantId: string,
  options: { warehouseId?: string; days?: number } = {},
): Promise<Array<MovementTrendPoint>> {
  const days = Math.min(Math.max(options.days ?? 30, 1), 365)
  const warehouseFilter = options.warehouseId
    ? Prisma.sql`AND warehouse_id = ${options.warehouseId}::uuid`
    : Prisma.empty

  const rows = await prisma.$queryRaw<
    Array<{
      day: string
      in_qty: string
      out_qty: string
      in_value: string
      out_value: string
    }>
  >(Prisma.sql`
    SELECT
      to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day,
      COALESCE(SUM(CASE WHEN qty_delta > 0 THEN qty_delta ELSE 0 END), 0)::text AS in_qty,
      COALESCE(SUM(CASE WHEN qty_delta < 0 THEN -qty_delta ELSE 0 END), 0)::text AS out_qty,
      COALESCE(SUM(CASE WHEN qty_delta > 0 THEN ABS(total_cost) ELSE 0 END), 0)::text AS in_value,
      COALESCE(SUM(CASE WHEN qty_delta < 0 THEN ABS(total_cost) ELSE 0 END), 0)::text AS out_value
    FROM inventory_movements
    WHERE tenant_id = ${tenantId}::uuid
      AND occurred_at >= now() - make_interval(days => ${days})
      AND movement_type::text NOT IN (${Prisma.join(NON_PHYSICAL_MOVEMENT_TYPES)})
      ${warehouseFilter}
    GROUP BY 1
    ORDER BY 1
  `)

  return rows.map((row) => ({
    day: row.day,
    inQty: String(row.in_qty),
    outQty: String(row.out_qty),
    inValue: String(row.in_value),
    outValue: String(row.out_value),
  }))
}

export interface WarehouseSummaryRow {
  warehouseId: string
  code: string
  name: string
  warehouseType: string
  isDefault: boolean
  isActive: boolean
  skuCount: number
  locationCount: number
  onHand: string
  totalValue: string
}

export async function getWarehouseSummaries(
  _context: CurrentUserContext,
  tenantId: string,
): Promise<Array<WarehouseSummaryRow>> {
  const [warehouses, stockRows, locationGroups] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        warehouseType: true,
        isDefault: true,
        isActive: true,
      },
    }),
    prisma.$queryRaw<
      Array<{
        warehouse_id: string
        sku_count: number
        on_hand: string
        total_value: string
      }>
    >(Prisma.sql`
      SELECT
        warehouse_id,
        COUNT(DISTINCT product_id)::int AS sku_count,
        COALESCE(SUM(on_hand), 0)::text AS on_hand,
        COALESCE(SUM(total_value), 0)::text AS total_value
      FROM stock_balances
      WHERE tenant_id = ${tenantId}::uuid
      GROUP BY warehouse_id
    `),
    prisma.warehouseLocation.groupBy({
      by: ['warehouseId'],
      where: { tenantId, deletedAt: null },
      _count: { _all: true },
    }),
  ])

  const stockByWarehouse = new Map(
    stockRows.map((row) => [row.warehouse_id, row]),
  )
  const locationsByWarehouse = new Map(
    locationGroups.map((group) => [group.warehouseId, group._count._all]),
  )

  return warehouses.map((warehouse) => {
    const stock = stockByWarehouse.get(warehouse.id)

    return {
      warehouseId: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      warehouseType: warehouse.warehouseType,
      isDefault: warehouse.isDefault,
      isActive: warehouse.isActive,
      skuCount: stock?.sku_count ?? 0,
      locationCount: locationsByWarehouse.get(warehouse.id) ?? 0,
      onHand: stock ? String(stock.on_hand) : '0',
      totalValue: stock ? String(stock.total_value) : '0',
    }
  })
}
