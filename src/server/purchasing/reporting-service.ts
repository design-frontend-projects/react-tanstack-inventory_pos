import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import type { CurrentUserContext } from '#/types/auth'

// Reporting reads over the Phase-0 SQL views (`pod_v_*`, always fresh) and
// materialized views (`pod_mv_*`, refreshed on demand / on a schedule).
// Numeric columns are cast to text/int IN SQL so every row is JSON-safe —
// no Decimal/bigint ever crosses the server-function boundary.

export interface AgingBucketRow {
  agingBucket: string
  invoiceCount: number
  outstanding: string
}

export interface SupplierBalanceRow {
  supplierId: string
  code: string
  name: string
  currencyCode: string
  currentBalance: string
  openInvoiceCount: number
  totalOutstanding: string
}

export interface MatchVarianceRow {
  invoiceId: string
  documentNumber: string
  matchStatusCode: string
  grandTotal: string
  matchedAmount: string
  priceVariance: string
  qtyVariance: string
}

export interface SpendByMonthRow {
  period: string
  currencyCode: string
  orderCount: number
  spend: string
}

export interface SupplierPerformanceRow {
  supplierId: string
  poCount: number
  totalSpend: string
  avgLeadTimeDays: string | null
  onTimePct: string | null
}

export interface OpenPoSummaryRow {
  poCount: number
  openValue: string
}

// One snapshot powering the purchasing overview: aging, balances, variances,
// spend trend, supplier performance, and open-PO exposure — all tenant-scoped.
export async function getPurchaseReportingSnapshot(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const [aging, balances, variances, spend, performance, openPos] =
    await Promise.all([
      prisma.$queryRaw<Array<AgingBucketRow>>`
        SELECT "aging_bucket" AS "agingBucket",
               COUNT(*)::int AS "invoiceCount",
               COALESCE(SUM("outstanding_amount"), 0)::text AS "outstanding"
        FROM "pod_v_outstanding_payables"
        WHERE "tenant_id" = ${tenantId}::uuid
        GROUP BY "aging_bucket"
        ORDER BY "aging_bucket"`,
      prisma.$queryRaw<Array<SupplierBalanceRow>>`
        SELECT "supplier_id" AS "supplierId", "code", "name",
               "currency_code" AS "currencyCode",
               COALESCE("current_balance", 0)::text AS "currentBalance",
               "open_invoice_count"::int AS "openInvoiceCount",
               "total_outstanding"::text AS "totalOutstanding"
        FROM "pod_v_supplier_balances"
        WHERE "tenant_id" = ${tenantId}::uuid
        ORDER BY "total_outstanding" DESC
        LIMIT 20`,
      prisma.$queryRaw<Array<MatchVarianceRow>>`
        SELECT "invoice_id" AS "invoiceId",
               "document_number" AS "documentNumber",
               "match_status_code" AS "matchStatusCode",
               "grand_total"::text AS "grandTotal",
               "matched_amount"::text AS "matchedAmount",
               "price_variance"::text AS "priceVariance",
               "qty_variance"::text AS "qtyVariance"
        FROM "pod_v_three_way_match_variance"
        WHERE "tenant_id" = ${tenantId}::uuid
          AND "match_status_code" IN ('variance', 'partially_matched')
        ORDER BY ABS("price_variance") DESC
        LIMIT 25`,
      prisma.$queryRaw<Array<SpendByMonthRow>>`
        SELECT TO_CHAR("period", 'YYYY-MM') AS "period",
               "currency_code" AS "currencyCode",
               SUM("order_count")::int AS "orderCount",
               SUM("spend")::text AS "spend"
        FROM "pod_mv_spend_analysis"
        WHERE "tenant_id" = ${tenantId}::uuid
        GROUP BY 1, 2
        ORDER BY 1 DESC
        LIMIT 12`,
      prisma.$queryRaw<Array<SupplierPerformanceRow>>`
        SELECT "supplier_id" AS "supplierId",
               "po_count"::int AS "poCount",
               "total_spend"::text AS "totalSpend",
               ROUND("avg_lead_time_days"::numeric, 1)::text AS "avgLeadTimeDays",
               ROUND("on_time_ratio"::numeric * 100, 1)::text AS "onTimePct"
        FROM "pod_mv_supplier_performance"
        WHERE "tenant_id" = ${tenantId}::uuid
        ORDER BY "total_spend" DESC
        LIMIT 20`,
      prisma.$queryRaw<Array<OpenPoSummaryRow>>`
        SELECT COUNT(*)::int AS "poCount",
               COALESCE(SUM("grand_total"), 0)::text AS "openValue"
        FROM "pod_v_open_purchase_orders"
        WHERE "tenant_id" = ${tenantId}::uuid`,
    ])

  return {
    payablesAging: aging,
    supplierBalances: balances,
    matchVariances: variances,
    spendByMonth: spend,
    supplierPerformance: performance,
    openPurchaseOrders: openPos[0] ?? { poCount: 0, openValue: '0' },
  }
}

const REPORTING_MATVIEWS = [
  'pod_mv_supplier_performance',
  'pod_mv_spend_analysis',
  'pod_mv_purchase_price_variance',
] as const

// The matviews are created WITH NO DATA, so the very first refresh of each
// must be non-concurrent; after that CONCURRENTLY keeps reads unblocked
// (matching the DB helper pod_refresh_reporting_matviews()).
export async function refreshReportingMatviews(
  context: CurrentUserContext,
  tenantId: string,
) {
  const populated = await prisma.$queryRaw<
    Array<{ matviewname: string; ispopulated: boolean }>
  >`SELECT matviewname, ispopulated FROM pg_matviews WHERE matviewname IN (${Prisma.join([...REPORTING_MATVIEWS])})`

  const populatedByName = new Map(
    populated.map((row) => [row.matviewname, row.ispopulated]),
  )

  for (const matview of REPORTING_MATVIEWS) {
    const mode = populatedByName.get(matview) ? 'CONCURRENTLY ' : ''

    await prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW ${mode}"${matview}"`,
    )
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'purchase.reporting_refresh',
    entityType: 'pod_reporting',
    entityId: tenantId,
    newValues: { matviews: REPORTING_MATVIEWS.length },
  })

  return { refreshed: [...REPORTING_MATVIEWS], refreshedAt: new Date() }
}
