import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import {
  averageTicket,
  buildHeatmapGrid,
  fillDailySeries,
  fillHourlySeries,
} from '#/server/restaurant/reporting/reporting-utils'
import type {
  DailyPoint,
  HeatmapCell,
  HourlyPoint,
} from '#/server/restaurant/reporting/reporting-utils'
import type { CurrentUserContext } from '#/types/auth'

// Read-only aggregations for the restaurant dashboard/reports/analytics.
// Everything is tenant-scoped SELECTs over res_orders/res_order_items — no
// writes. Money crosses the wire as strings (Decimal serialization rule).
// NOTE: raw SQL must use the DB-mapped (lowercase) enum values — Prisma enum
// names like COMPLETED are @map'ped to 'completed' at the column level.

function branchFilter(branchId?: string) {
  return branchId ? Prisma.sql`AND o.branch_id = ${branchId}::uuid` : Prisma.empty
}

export interface DashboardSnapshot {
  todaySales: string
  todayOrders: number
  todayGuests: number
  averageTicket: string
  todayTips: string
  todayDiscounts: string
  openOrders: number
  kitchenQueue: number
  serviceMix: Array<{ orderType: string; orders: number; sales: string }>
  channelMix: Array<{ channel: string; orders: number; sales: string }>
  paymentMix: Array<{ method: string; amount: string; count: number }>
  tableStatus: { total: number; available: number; occupied: number; reserved: number; blocked: number }
  hourlySales: Array<HourlyPoint>
  topItems: Array<{ name: string; quantity: string; sales: string }>
  recentEvents: Array<{
    id: string
    orderId: string
    orderNumber: string
    toStatus: string
    reason: string | null
    createdAt: string
  }>
}

export async function getDashboardSnapshot(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId?: string; from: string; to: string },
): Promise<DashboardSnapshot> {
  const from = new Date(input.from)
  const to = new Date(input.to)
  const branch = branchFilter(input.branchId)

  const [totalsRows, openRows, queueRows, serviceRows, channelRows, paymentRows, tableRows, hourlyRows, topItemRows, eventRows] =
    await Promise.all([
      prisma.$queryRaw<Array<{ sales: string; orders: number; guests: number; tips: string; discounts: string }>>(Prisma.sql`
        SELECT
          COALESCE(SUM(o.grand_total), 0)::text AS sales,
          COUNT(*)::int AS orders,
          COALESCE(SUM(o.guest_count), 0)::int AS guests,
          COALESCE(SUM(o.tip_total), 0)::text AS tips,
          COALESCE(SUM(o.discount_total), 0)::text AS discounts
        FROM res_orders o
        WHERE o.tenant_id = ${tenantId}::uuid
          AND o.deleted_at IS NULL
          AND o.status = 'completed'
          AND o.completed_at >= ${from} AND o.completed_at < ${to}
          ${branch}
      `),
      prisma.$queryRaw<Array<{ open_orders: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS open_orders
        FROM res_orders o
        WHERE o.tenant_id = ${tenantId}::uuid
          AND o.deleted_at IS NULL
          AND o.status NOT IN ('completed', 'cancelled', 'refunded', 'voided', 'draft')
          ${branch}
      `),
      prisma.$queryRaw<Array<{ queue: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS queue
        FROM res_order_items i
        JOIN res_orders o ON o.id = i.order_id
        WHERE i.tenant_id = ${tenantId}::uuid
          AND i.status IN ('fired', 'preparing')
          AND o.deleted_at IS NULL
          ${branch}
      `),
      prisma.$queryRaw<Array<{ order_type: string; orders: number; sales: string }>>(Prisma.sql`
        SELECT o.order_type::text AS order_type, COUNT(*)::int AS orders,
               COALESCE(SUM(o.grand_total), 0)::text AS sales
        FROM res_orders o
        WHERE o.tenant_id = ${tenantId}::uuid
          AND o.deleted_at IS NULL
          AND o.status = 'completed'
          AND o.completed_at >= ${from} AND o.completed_at < ${to}
          ${branch}
        GROUP BY o.order_type
        ORDER BY orders DESC
      `),
      prisma.$queryRaw<Array<{ channel: string; orders: number; sales: string }>>(Prisma.sql`
        SELECT o.channel::text AS channel, COUNT(*)::int AS orders,
               COALESCE(SUM(o.grand_total), 0)::text AS sales
        FROM res_orders o
        WHERE o.tenant_id = ${tenantId}::uuid
          AND o.deleted_at IS NULL
          AND o.status = 'completed'
          AND o.completed_at >= ${from} AND o.completed_at < ${to}
          ${branch}
        GROUP BY o.channel
        ORDER BY orders DESC
      `),
      prisma.$queryRaw<Array<{ method: string; amount: string; count: number }>>(Prisma.sql`
        SELECT p.method::text AS method, COALESCE(SUM(p.amount), 0)::text AS amount,
               COUNT(*)::int AS count
        FROM res_order_payments p
        JOIN res_orders o ON o.id = p.order_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.status = 'captured'
          AND p.created_at >= ${from} AND p.created_at < ${to}
          AND o.deleted_at IS NULL
          ${branch}
        GROUP BY p.method
        ORDER BY amount DESC
      `),
      prisma.$queryRaw<Array<{ status: string; count: number }>>(Prisma.sql`
        SELECT t.status::text AS status, COUNT(*)::int AS count
        FROM res_tables t
        WHERE t.tenant_id = ${tenantId}::uuid
          AND t.deleted_at IS NULL
          AND t.is_active = TRUE
          ${input.branchId ? Prisma.sql`AND t.branch_id = ${input.branchId}::uuid` : Prisma.empty}
        GROUP BY t.status
      `),
      prisma.$queryRaw<Array<{ hour: number; sales: string; orders: number }>>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM o.completed_at)::int AS hour,
               COALESCE(SUM(o.grand_total), 0)::text AS sales,
               COUNT(*)::int AS orders
        FROM res_orders o
        WHERE o.tenant_id = ${tenantId}::uuid
          AND o.deleted_at IS NULL
          AND o.status = 'completed'
          AND o.completed_at >= ${from} AND o.completed_at < ${to}
          ${branch}
        GROUP BY 1
        ORDER BY 1
      `),
      prisma.$queryRaw<Array<{ name: string; quantity: string; sales: string }>>(Prisma.sql`
        SELECT i.name, COALESCE(SUM(i.quantity), 0)::text AS quantity,
               COALESCE(SUM(i.line_total), 0)::text AS sales
        FROM res_order_items i
        JOIN res_orders o ON o.id = i.order_id
        WHERE i.tenant_id = ${tenantId}::uuid
          AND i.status <> 'voided'
          AND o.deleted_at IS NULL
          AND o.status = 'completed'
          AND o.completed_at >= ${from} AND o.completed_at < ${to}
          ${branch}
        GROUP BY i.name
        ORDER BY SUM(i.line_total) DESC
        LIMIT 10
      `),
      prisma.$queryRaw<Array<{ id: string; order_id: string; order_number: string; to_status: string; reason: string | null; created_at: Date }>>(Prisma.sql`
        SELECT e.id, e.order_id, o.order_number, e.to_status::text AS to_status,
               e.reason, e.created_at
        FROM res_order_events e
        JOIN res_orders o ON o.id = e.order_id
        WHERE e.tenant_id = ${tenantId}::uuid
          AND o.deleted_at IS NULL
          ${branch}
        ORDER BY e.created_at DESC
        LIMIT 12
      `),
    ])

  const totals = totalsRows[0] ?? {
    sales: '0',
    orders: 0,
    guests: 0,
    tips: '0',
    discounts: '0',
  }
  const tableStatus = { total: 0, available: 0, occupied: 0, reserved: 0, blocked: 0 }
  for (const row of tableRows) {
    tableStatus.total += row.count
    if (row.status === 'available') tableStatus.available += row.count
    else if (row.status === 'occupied') tableStatus.occupied += row.count
    else if (row.status === 'reserved') tableStatus.reserved += row.count
    else tableStatus.blocked += row.count
  }

  return {
    todaySales: totals.sales,
    todayOrders: totals.orders,
    todayGuests: totals.guests,
    averageTicket: averageTicket(totals.sales, totals.orders),
    todayTips: totals.tips,
    todayDiscounts: totals.discounts,
    openOrders: openRows[0]?.open_orders ?? 0,
    kitchenQueue: queueRows[0]?.queue ?? 0,
    serviceMix: serviceRows.map((row) => ({
      orderType: row.order_type,
      orders: row.orders,
      sales: row.sales,
    })),
    channelMix: channelRows.map((row) => ({
      channel: row.channel,
      orders: row.orders,
      sales: row.sales,
    })),
    paymentMix: paymentRows,
    tableStatus,
    hourlySales: fillHourlySeries(hourlyRows),
    topItems: topItemRows,
    recentEvents: eventRows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      toStatus: row.to_status,
      reason: row.reason,
      createdAt: row.created_at.toISOString(),
    })),
  }
}

export interface AnalyticsSnapshot {
  trend: Array<DailyPoint>
  heatmap: Array<HeatmapCell>
  kitchen: Array<{ date: string; avgPrepMinutes: string; orders: number }>
  staff: Array<{ profileId: string | null; orders: number; sales: string }>
}

export async function getAnalyticsSnapshot(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId?: string; from: string; to: string },
): Promise<AnalyticsSnapshot> {
  const from = new Date(input.from)
  const to = new Date(input.to)
  const branch = branchFilter(input.branchId)

  const [dailyRows, heatRows, kitchenRows, staffRows] = await Promise.all([
    prisma.$queryRaw<Array<{ date: string; sales: string; orders: number }>>(Prisma.sql`
      SELECT to_char(date_trunc('day', o.completed_at), 'YYYY-MM-DD') AS date,
             COALESCE(SUM(o.grand_total), 0)::text AS sales,
             COUNT(*)::int AS orders
      FROM res_orders o
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.deleted_at IS NULL
        AND o.status = 'completed'
        AND o.completed_at >= ${from} AND o.completed_at < ${to}
        ${branch}
      GROUP BY 1
      ORDER BY 1
    `),
    prisma.$queryRaw<Array<{ dow: number; hour: number; sales: string; orders: number }>>(Prisma.sql`
      SELECT EXTRACT(DOW FROM o.completed_at)::int AS dow,
             EXTRACT(HOUR FROM o.completed_at)::int AS hour,
             COALESCE(SUM(o.grand_total), 0)::text AS sales,
             COUNT(*)::int AS orders
      FROM res_orders o
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.deleted_at IS NULL
        AND o.status = 'completed'
        AND o.completed_at >= ${from} AND o.completed_at < ${to}
        ${branch}
      GROUP BY 1, 2
    `),
    prisma.$queryRaw<Array<{ date: string; avg_prep_minutes: string; orders: number }>>(Prisma.sql`
      SELECT to_char(date_trunc('day', o.completed_at), 'YYYY-MM-DD') AS date,
             COALESCE(AVG(EXTRACT(EPOCH FROM (o.served_at - o.confirmed_at)) / 60), 0)::numeric(10,1)::text AS avg_prep_minutes,
             COUNT(*)::int AS orders
      FROM res_orders o
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.deleted_at IS NULL
        AND o.status = 'completed'
        AND o.confirmed_at IS NOT NULL AND o.served_at IS NOT NULL
        AND o.completed_at >= ${from} AND o.completed_at < ${to}
        ${branch}
      GROUP BY 1
      ORDER BY 1
    `),
    prisma.$queryRaw<Array<{ profile_id: string | null; orders: number; sales: string }>>(Prisma.sql`
      SELECT o.opened_by_profile_id AS profile_id, COUNT(*)::int AS orders,
             COALESCE(SUM(o.grand_total), 0)::text AS sales
      FROM res_orders o
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.deleted_at IS NULL
        AND o.status = 'completed'
        AND o.completed_at >= ${from} AND o.completed_at < ${to}
        ${branch}
      GROUP BY o.opened_by_profile_id
      ORDER BY SUM(o.grand_total) DESC
      LIMIT 15
    `),
  ])

  return {
    trend: fillDailySeries(dailyRows, input.from, input.to),
    heatmap: buildHeatmapGrid(heatRows),
    kitchen: kitchenRows.map((row) => ({
      date: row.date,
      avgPrepMinutes: row.avg_prep_minutes,
      orders: row.orders,
    })),
    staff: staffRows.map((row) => ({
      profileId: row.profile_id,
      orders: row.orders,
      sales: row.sales,
    })),
  }
}

export interface SalesReportRow {
  date: string
  orders: number
  guests: number
  sales: string
  discounts: string
  tips: string
  taxes: string
  serviceCharges: string
}

export async function getSalesReport(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId?: string; from: string; to: string },
): Promise<Array<SalesReportRow>> {
  const from = new Date(input.from)
  const to = new Date(input.to)
  const branch = branchFilter(input.branchId)

  const rows = await prisma.$queryRaw<
    Array<{
      date: string
      orders: number
      guests: number
      sales: string
      discounts: string
      tips: string
      taxes: string
      service_charges: string
    }>
  >(Prisma.sql`
    SELECT to_char(date_trunc('day', o.completed_at), 'YYYY-MM-DD') AS date,
           COUNT(*)::int AS orders,
           COALESCE(SUM(o.guest_count), 0)::int AS guests,
           COALESCE(SUM(o.grand_total), 0)::text AS sales,
           COALESCE(SUM(o.discount_total), 0)::text AS discounts,
           COALESCE(SUM(o.tip_total), 0)::text AS tips,
           COALESCE(SUM(o.tax_total), 0)::text AS taxes,
           COALESCE(SUM(o.service_charge_total), 0)::text AS service_charges
    FROM res_orders o
    WHERE o.tenant_id = ${tenantId}::uuid
      AND o.deleted_at IS NULL
      AND o.status = 'completed'
      AND o.completed_at >= ${from} AND o.completed_at < ${to}
      ${branch}
    GROUP BY 1
    ORDER BY 1 DESC
  `)

  return rows.map((row) => ({
    date: row.date,
    orders: row.orders,
    guests: row.guests,
    sales: row.sales,
    discounts: row.discounts,
    tips: row.tips,
    taxes: row.taxes,
    serviceCharges: row.service_charges,
  }))
}

export interface ItemReportRow {
  name: string
  quantity: string
  sales: string
  orders: number
}

export async function getItemsReport(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId?: string; from: string; to: string },
): Promise<Array<ItemReportRow>> {
  const from = new Date(input.from)
  const to = new Date(input.to)
  const branch = branchFilter(input.branchId)

  return prisma.$queryRaw<Array<ItemReportRow>>(Prisma.sql`
    SELECT i.name, COALESCE(SUM(i.quantity), 0)::text AS quantity,
           COALESCE(SUM(i.line_total), 0)::text AS sales,
           COUNT(DISTINCT i.order_id)::int AS orders
    FROM res_order_items i
    JOIN res_orders o ON o.id = i.order_id
    WHERE i.tenant_id = ${tenantId}::uuid
      AND i.status <> 'voided'
      AND o.deleted_at IS NULL
      AND o.status = 'completed'
      AND o.completed_at >= ${from} AND o.completed_at < ${to}
      ${branch}
    GROUP BY i.name
    ORDER BY SUM(i.line_total) DESC
    LIMIT 100
  `)
}
