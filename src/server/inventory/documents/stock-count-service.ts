import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as balanceRepo from '#/server/repos/stock-balance-repo'
import * as countRepo from '#/server/repos/stock-count-repo'
import {
  createAdjustment,
  postAdjustment,
} from '#/server/inventory/documents/stock-adjustment-service'
import type { CurrentUserContext } from '#/types/auth'

// Stock counts deliberately own no posting logic. A session snapshots system
// quantities, collects counted quantities, then on approval hands the variance
// to the stock-adjustment service — so counts and manual adjustments share one
// audited path into the movement ledger.

type CountSession = NonNullable<
  Awaited<ReturnType<typeof countRepo.findStockCountById>>
>

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeStockCount(session: CountSession) {
  return {
    ...session,
    lines: session.lines.map((line) => ({
      ...line,
      systemQty: line.systemQty.toString(),
      countedQty: dec(line.countedQty),
      unitCost: dec(line.unitCost),
      // Variance is derived, never stored — an uncounted line has no variance.
      variance:
        line.countedQty === null
          ? null
          : new Prisma.Decimal(line.countedQty)
              .minus(line.systemQty)
              .toString(),
    })),
  }
}

export interface CreateStockCountInput {
  warehouseId: string
  isCycleCount?: boolean
  notes?: string | null
  // Restrict the generated lines to a subset of products (cycle counting).
  productIds?: Array<string>
}

// Lines are generated from current stock balances so the session captures the
// system quantity at the moment counting starts.
export async function createStockCount(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateStockCountInput,
) {
  const balances = await balanceRepo.listBalances(tenantId, {
    warehouseId: input.warehouseId,
    onlyNonZero: false,
    take: 500,
  })

  const scoped =
    input.productIds && input.productIds.length > 0
      ? balances.filter((balance) =>
          input.productIds?.includes(balance.productId),
        )
      : balances

  if (scoped.length === 0) {
    throw new ConflictError(
      'No stock balances found for this warehouse, so there is nothing to count.',
    )
  }

  // Balances are stored per grain and carry no unit of measure, so the counting
  // unit comes from each product's base UoM.
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      id: { in: [...new Set(scoped.map((b) => b.productId))] },
    },
    select: { id: true, baseUomId: true },
  })
  const baseUomByProduct = new Map(products.map((p) => [p.id, p.baseUomId]))

  const countable = scoped.filter((balance) =>
    baseUomByProduct.has(balance.productId),
  )

  if (countable.length === 0) {
    throw new ConflictError(
      'No countable products found for this warehouse — the matching products are missing a base unit of measure.',
    )
  }

  const session = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'STOCK_COUNT',
    })

    const created = await countRepo.createStockCount(
      tenantId,
      {
        documentNumber,
        warehouseId: input.warehouseId,
        isCycleCount: input.isCycleCount ?? false,
        notes: input.notes ?? null,
        createdByProfileId: context.profileId,
        lines: countable.map((balance) => ({
          productId: balance.productId,
          variantId: balance.variantId,
          locationId: balance.locationId,
          lotId: balance.lotId,
          serialId: balance.serialId,
          uomId: baseUomByProduct.get(balance.productId)!,
          systemQty: balance.onHand,
          unitCost: balance.avgUnitCost,
        })),
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'inventory.count_create',
        entityType: 'stock_count_session',
        entityId: created.id,
        newValues: { documentNumber, lineCount: countable.length },
      },
      tx,
    )

    return created
  })

  return serializeStockCount(session)
}

export async function startStockCount(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const session = await countRepo.findStockCountById(tenantId, id)

  if (!session) {
    throw new NotFoundError('Stock count not found.')
  }

  if (session.status !== 'DRAFT') {
    throw new ConflictError('Only a draft count session can be started.')
  }

  await countRepo.updateStockCountStatus(tenantId, id, 'COUNTING', {
    startedAt: new Date(),
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.count_start',
    entityType: 'stock_count_session',
    entityId: id,
    newValues: { documentNumber: session.documentNumber },
  })

  const refreshed = await countRepo.findStockCountById(tenantId, id)

  return serializeStockCount(refreshed!)
}

export async function recordCounts(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  entries: Array<{ lineId: string; countedQty: string; notes?: string | null }>,
) {
  const session = await countRepo.findStockCountById(tenantId, id)

  if (!session) {
    throw new NotFoundError('Stock count not found.')
  }

  if (session.status !== 'COUNTING' && session.status !== 'REVIEW') {
    throw new ConflictError(
      'Counted quantities can only be recorded while the session is counting or under review.',
    )
  }

  await countRepo.recordCountedQuantities(tenantId, id, entries)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.count_record',
    entityType: 'stock_count_session',
    entityId: id,
    newValues: { lineCount: entries.length },
  })

  const refreshed = await countRepo.findStockCountById(tenantId, id)

  return serializeStockCount(refreshed!)
}

// Moves a counting session into variance review. Every line must be counted so
// an uncounted line is never silently treated as zero on hand.
export async function reviewStockCount(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const session = await countRepo.findStockCountById(tenantId, id)

  if (!session) {
    throw new NotFoundError('Stock count not found.')
  }

  if (session.status !== 'COUNTING') {
    throw new ConflictError('Only a counting session can be sent to review.')
  }

  const uncounted = session.lines.filter((line) => line.countedQty === null)

  if (uncounted.length > 0) {
    throw new ConflictError(
      `${uncounted.length} line(s) have no counted quantity. Record every line before review.`,
    )
  }

  await countRepo.updateStockCountStatus(tenantId, id, 'REVIEW', {
    countedAt: new Date(),
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.count_review',
    entityType: 'stock_count_session',
    entityId: id,
    newValues: { documentNumber: session.documentNumber },
  })

  const refreshed = await countRepo.findStockCountById(tenantId, id)

  return serializeStockCount(refreshed!)
}

// Approval builds a CORRECTION adjustment from the non-zero variances and posts
// it through the adjustment service, which owns the movement/balance writes.
export async function approveStockCount(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const session = await countRepo.findStockCountById(tenantId, id)

  if (!session) {
    throw new NotFoundError('Stock count not found.')
  }

  if (session.status !== 'REVIEW') {
    throw new ConflictError('Only a session under review can be approved.')
  }

  const varianceLines = session.lines
    .map((line) => {
      const counted = line.countedQty
      if (counted === null) {
        return null
      }
      const qtyDelta = new Prisma.Decimal(counted).minus(line.systemQty)
      if (qtyDelta.eq(0)) {
        return null
      }
      return {
        productId: line.productId,
        variantId: line.variantId,
        locationId: line.locationId,
        lotId: line.lotId,
        serialId: line.serialId,
        uomId: line.uomId,
        systemQty: line.systemQty,
        adjustedQty: new Prisma.Decimal(counted),
        qtyDelta,
        unitCost: line.unitCost,
        reason: `Stock count ${session.documentNumber}`,
      }
    })
    .filter((line): line is NonNullable<typeof line> => line !== null)

  let postedAdjustmentId: string | null = null

  // A session with no variances still closes out — it just has nothing to post.
  if (varianceLines.length > 0) {
    const adjustment = await createAdjustment(context, tenantId, {
      warehouseId: session.warehouseId,
      reasonCode: 'CORRECTION',
      notes: `Variance from stock count ${session.documentNumber}`,
      lines: varianceLines,
    })

    await postAdjustment(context, tenantId, adjustment.id)
    postedAdjustmentId = adjustment.id
  }

  await countRepo.updateStockCountStatus(tenantId, id, 'POSTED', {
    postedAt: new Date(),
    postedAdjustmentId,
    approvedByProfileId: context.profileId,
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.count_approve',
    entityType: 'stock_count_session',
    entityId: id,
    newValues: {
      documentNumber: session.documentNumber,
      postedAdjustmentId,
      varianceLineCount: varianceLines.length,
    },
  })

  const refreshed = await countRepo.findStockCountById(tenantId, id)

  return serializeStockCount(refreshed!)
}

export async function cancelStockCount(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const session = await countRepo.findStockCountById(tenantId, id)

  if (!session) {
    throw new NotFoundError('Stock count not found.')
  }

  if (session.status === 'POSTED') {
    throw new ConflictError('A posted stock count cannot be cancelled.')
  }

  await countRepo.updateStockCountStatus(tenantId, id, 'CANCELLED')

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.count_cancel',
    entityType: 'stock_count_session',
    entityId: id,
    newValues: { documentNumber: session.documentNumber },
  })

  const refreshed = await countRepo.findStockCountById(tenantId, id)

  return serializeStockCount(refreshed!)
}

export function listStockCounts(
  _context: CurrentUserContext,
  tenantId: string,
) {
  return countRepo.listStockCounts(tenantId, {})
}

export async function getStockCount(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const session = await countRepo.findStockCountById(tenantId, id)

  if (!session) {
    throw new NotFoundError('Stock count not found.')
  }

  return serializeStockCount(session)
}
