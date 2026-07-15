import { aggregateValuation } from '#/server/inventory/valuation-logic'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as snapshotRepo from '#/server/repos/stock-snapshot-repo'
import type { CurrentUserContext } from '#/types/auth'

const ZERO = new Prisma.Decimal(0)

// Live valuation: aggregate on-hand and total value per product × warehouse from
// the materialized balances, plus a grand total with the blended WAC.
export async function getValuationSummary(
  _context: CurrentUserContext,
  tenantId: string,
  warehouseId?: string
) {
  const groups = await prisma.stockBalance.groupBy({
    by: ['productId', 'warehouseId'],
    where: { tenantId, ...(warehouseId ? { warehouseId } : {}) },
    _sum: { onHand: true, totalValue: true },
  })

  const byProduct = groups.map((group) => {
    const onHand = group._sum.onHand ?? ZERO
    const totalValue = group._sum.totalValue ?? ZERO
    const avgUnitCost = onHand.gt(ZERO) ? totalValue.div(onHand) : ZERO

    return {
      productId: group.productId,
      warehouseId: group.warehouseId,
      onHand: onHand.toString(),
      totalValue: totalValue.toString(),
      avgUnitCost: avgUnitCost.toString(),
    }
  })

  const totals = aggregateValuation(
    groups.map((group) => ({
      onHand: group._sum.onHand ?? ZERO,
      totalValue: group._sum.totalValue ?? ZERO,
    }))
  )

  return {
    totals: {
      onHand: totals.onHand.toString(),
      totalValue: totals.totalValue.toString(),
      avgUnitCost: totals.avgUnitCost.toString(),
    },
    byProduct,
  }
}

// Materialize a point-in-time valuation for a period: aggregate the current
// balances per product × variant × warehouse and (re)write the period's snapshot
// rows atomically. Idempotent per period. Intended for a monthly scheduled job.
export async function takeSnapshot(
  context: CurrentUserContext,
  tenantId: string,
  periodKey: string,
  snapshotDate: Date = new Date()
) {
  const groups = await prisma.stockBalance.groupBy({
    by: ['productId', 'variantId', 'warehouseId'],
    where: { tenantId },
    _sum: {
      onHand: true,
      reserved: true,
      allocated: true,
      totalValue: true,
    },
  })

  const rows = groups.map((group) => {
    const onHand = group._sum.onHand ?? ZERO
    const totalValue = group._sum.totalValue ?? ZERO

    return {
      productId: group.productId,
      variantId: group.variantId,
      warehouseId: group.warehouseId,
      onHand,
      reserved: group._sum.reserved ?? ZERO,
      allocated: group._sum.allocated ?? ZERO,
      avgUnitCost: onHand.gt(ZERO) ? totalValue.div(onHand) : ZERO,
      totalValue,
    }
  })

  const count = await prisma.$transaction(async (tx) => {
    await snapshotRepo.deleteSnapshotPeriod(tenantId, periodKey, tx)

    return snapshotRepo.createSnapshotRows(tenantId, periodKey, snapshotDate, rows, tx)
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.snapshot_take',
    entityType: 'stock_snapshot',
    entityId: tenantId,
    newValues: { periodKey, rows: count },
  })

  return { periodKey, rows: count }
}

export async function listSnapshots(
  _context: CurrentUserContext,
  tenantId: string,
  periodKey?: string
) {
  const snapshots = await snapshotRepo.listSnapshots(
    tenantId,
    periodKey ? { periodKey } : {}
  )

  return snapshots.map((snapshot) => ({
    ...snapshot,
    onHand: snapshot.onHand.toString(),
    reserved: snapshot.reserved.toString(),
    allocated: snapshot.allocated.toString(),
    avgUnitCost: snapshot.avgUnitCost.toString(),
    totalValue: snapshot.totalValue.toString(),
  }))
}
