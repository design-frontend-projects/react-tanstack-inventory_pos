import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as brandRepo from '#/server/repos/brand-repo'
import * as categoryRepo from '#/server/repos/category-repo'
import * as productRepo from '#/server/repos/product-repo'
import * as uomRepo from '#/server/repos/uom-repo'
import type { ProductImportRow } from '#/features/products/import/import-schema'
import type { CurrentUserContext } from '#/types/auth'

// Bulk product import: rows arrive schema-validated (see import-schema.ts)
// with master data referenced by code. The service resolves codes to ids,
// skips duplicate SKUs (existing or repeated within the batch — there is no
// DB unique constraint on tenant+sku), creates the rest row by row so one bad
// row never aborts the batch, and records a single audit entry.

export interface ProductImportRowResult {
  row: number
  sku: string
  status: 'created' | 'skipped' | 'failed'
  message?: string
}

export interface ProductImportSummary {
  created: number
  skipped: number
  failed: number
  results: Array<ProductImportRowResult>
}

interface CodeLookup {
  byCode: Map<string, string>
  byName: Map<string, string>
}

function buildLookup(
  items: Array<{ id: string; code?: string | null; name: string }>,
): CodeLookup {
  const byCode = new Map<string, string>()
  const byName = new Map<string, string>()

  for (const item of items) {
    if (item.code) {
      byCode.set(item.code.trim().toLowerCase(), item.id)
    }
    byName.set(item.name.trim().toLowerCase(), item.id)
  }

  return { byCode, byName }
}

// Codes match first; falling back to the display name keeps spreadsheet
// exports (which usually carry names) importable without a code column.
function resolveCode(lookup: CodeLookup, value: string): string | undefined {
  const needle = value.trim().toLowerCase()
  return lookup.byCode.get(needle) ?? lookup.byName.get(needle)
}

export async function importProducts(
  context: CurrentUserContext,
  tenantId: string,
  rows: Array<ProductImportRow>,
): Promise<ProductImportSummary> {
  const [uoms, categories, brands, existing] = await Promise.all([
    uomRepo.listUoms(tenantId, { includeInactive: true }),
    categoryRepo.listCategories(tenantId, { includeInactive: true }),
    brandRepo.listBrands(tenantId, { includeInactive: true }),
    prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: { sku: true },
    }),
  ])

  const uomLookup = buildLookup(uoms)
  const categoryLookup = buildLookup(categories)
  const brandLookup = buildLookup(brands)
  const seenSkus = new Set(existing.map((product) => product.sku.toLowerCase()))

  const results: Array<ProductImportRowResult> = []

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1
    const skuKey = row.sku.toLowerCase()

    if (seenSkus.has(skuKey)) {
      results.push({
        row: rowNumber,
        sku: row.sku,
        status: 'skipped',
        message: 'SKU already exists.',
      })
      continue
    }

    const baseUomId = resolveCode(uomLookup, row.baseUomCode)
    if (!baseUomId) {
      results.push({
        row: rowNumber,
        sku: row.sku,
        status: 'failed',
        message: `Unknown base UoM "${row.baseUomCode}".`,
      })
      continue
    }

    const unresolved: Array<string> = []
    const categoryId = row.categoryCode
      ? resolveCode(categoryLookup, row.categoryCode)
      : undefined
    if (row.categoryCode && !categoryId) {
      unresolved.push(`category "${row.categoryCode}"`)
    }

    const brandId = row.brandCode
      ? resolveCode(brandLookup, row.brandCode)
      : undefined
    if (row.brandCode && !brandId) {
      unresolved.push(`brand "${row.brandCode}"`)
    }

    const salesUomId = row.salesUomCode
      ? resolveCode(uomLookup, row.salesUomCode)
      : undefined
    if (row.salesUomCode && !salesUomId) {
      unresolved.push(`sales UoM "${row.salesUomCode}"`)
    }

    const purchaseUomId = row.purchaseUomCode
      ? resolveCode(uomLookup, row.purchaseUomCode)
      : undefined
    if (row.purchaseUomCode && !purchaseUomId) {
      unresolved.push(`purchase UoM "${row.purchaseUomCode}"`)
    }

    if (unresolved.length > 0) {
      results.push({
        row: rowNumber,
        sku: row.sku,
        status: 'failed',
        message: `Unknown ${unresolved.join(', ')}.`,
      })
      continue
    }

    try {
      await productRepo.createProduct(tenantId, {
        sku: row.sku,
        name: row.name,
        description: row.description ?? null,
        barcode: row.barcode ?? null,
        productType: row.productType,
        trackingPolicy: row.trackingPolicy,
        costingMethod: row.costingMethod,
        status: row.status,
        categoryId: categoryId ?? null,
        brandId: brandId ?? null,
        baseUomId,
        salesUomId: salesUomId ?? null,
        purchaseUomId: purchaseUomId ?? null,
        standardCost: row.standardCost ?? null,
        defaultPrice: row.defaultPrice ?? null,
        reorderPoint: row.reorderPoint ?? null,
        reorderQty: row.reorderQty ?? null,
        minStock: row.minStock ?? null,
        maxStock: row.maxStock ?? null,
        safetyStock: row.safetyStock ?? null,
        leadTimeDays: row.leadTimeDays ?? null,
        shelfLifeDays: row.shelfLifeDays ?? null,
        isStockTracked: row.isStockTracked,
        hasExpiry: row.hasExpiry,
      })

      seenSkus.add(skuKey)
      results.push({ row: rowNumber, sku: row.sku, status: 'created' })
    } catch (error: unknown) {
      results.push({
        row: rowNumber,
        sku: row.sku,
        status: 'failed',
        message:
          error instanceof Error ? error.message : 'Could not create product.',
      })
    }
  }

  const summary: ProductImportSummary = {
    created: results.filter((result) => result.status === 'created').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'product.import',
    entityType: 'product',
    entityId: null,
    newValues: {
      rows: rows.length,
      created: summary.created,
      skipped: summary.skipped,
      failed: summary.failed,
    },
  })

  return summary
}
