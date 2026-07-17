import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { postValueAdjustment } from '#/server/inventory/movement-engine'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as grnRepo from '#/server/repos/goods-receipt-repo'
import * as voucherRepo from '#/server/repos/pod-landed-cost-repo'
import {
  allocateLandedCost,
  allocateProRata
  
} from '#/server/purchasing/landed-cost-allocation'
import type {AllocationBasis} from '#/server/purchasing/landed-cost-allocation';
import { serializeLandedCostVoucher } from '#/server/purchasing/landed-cost-dto'
import { assertPodTransition } from '#/server/purchasing/pod-status-service'
import type { CurrentUserContext } from '#/types/auth'
import type { PrismaClientLike } from '#/server/db/types'

export interface CreateLandedCostInput {
  goodsReceiptId: string
  purchaseOrderId?: string | null
  supplierInvoiceId?: string | null
  allocationBasis?: AllocationBasis
  currencyCode?: string
  exchangeRate?: string | number | null
  notes?: string | null
  charges: Array<{
    costTypeId?: string | null
    description?: string | null
    amount: string | number
    taxAmount?: string | number | null
    supplierId?: string | null
  }>
}

// A landed-cost voucher anchors to a goods receipt: its accepted lines are the
// allocation targets, and posting folds the charges into the cost of exactly
// the stock that receipt brought in.
export async function createLandedCostVoucher(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateLandedCostInput,
) {
  if (input.charges.length === 0) {
    throw new ConflictError(
      'A landed-cost voucher requires at least one charge.',
    )
  }

  const receipt = await grnRepo.findGoodsReceiptById(
    tenantId,
    input.goodsReceiptId,
  )

  if (!receipt) {
    throw new NotFoundError('Goods receipt not found.')
  }

  const voucher = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'LANDED_COST',
    })

    const created = await voucherRepo.createVoucher(
      tenantId,
      {
        documentNumber,
        goodsReceiptId: receipt.id,
        purchaseOrderId: input.purchaseOrderId ?? receipt.purchaseOrderId,
        supplierInvoiceId: input.supplierInvoiceId ?? null,
        allocationBasis: input.allocationBasis ?? 'value',
        currencyCode: input.currencyCode ?? 'USD',
        exchangeRate: input.exchangeRate ?? 1,
        notes: input.notes ?? null,
        createdBy: context.profileId,
        charges: input.charges,
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.landed_cost_create',
        entityType: 'pod_landed_cost_voucher',
        entityId: created.id,
        newValues: { documentNumber, goodsReceiptId: receipt.id },
      },
      tx,
    )

    // total_charges is written by the charge trigger — refetch inside the tx.
    return (await voucherRepo.findVoucherById(tenantId, created.id, tx))!
  })

  return serializeLandedCostVoucher(voucher)
}

// Per-unit weights for the `weight` basis: variant weight wins over product.
async function loadWeights(
  tenantId: string,
  lines: Array<{ productId: string; variantId: string | null }>,
  client: PrismaClientLike,
): Promise<Map<string, Prisma.Decimal>> {
  const productIds = Array.from(new Set(lines.map((line) => line.productId)))
  const variantIds = Array.from(
    new Set(
      lines
        .map((line) => line.variantId)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const [products, variants] = await Promise.all([
    client.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, weight: true },
    }),
    variantIds.length
      ? client.productVariant.findMany({
          where: { tenantId, id: { in: variantIds } },
          select: { id: true, weight: true },
        })
      : Promise.resolve([]),
  ])

  const weights = new Map<string, Prisma.Decimal>()

  for (const product of products) {
    if (product.weight) {
      weights.set(`p:${product.id}`, product.weight)
    }
  }

  for (const variant of variants) {
    if (variant.weight) {
      weights.set(`v:${variant.id}`, variant.weight)
    }
  }

  return weights
}

// Distributes total charges across the receipt's accepted lines by the
// voucher's basis. Re-allocation while still `allocated` simply replaces the
// derived rows; the first allocation moves draft -> allocated.
export async function allocateLandedCostVoucher(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: {
    manualBasis?: Array<{
      goodsReceiptLineId: string
      basisValue: string | number
    }>
  } = {},
) {
  const voucher = await prisma.$transaction(async (tx) => {
    const existing = await voucherRepo.findVoucherById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Landed-cost voucher not found.')
    }

    if (existing.isPosted) {
      throw new ConflictError('A posted voucher cannot be re-allocated.')
    }

    if (!existing.goodsReceiptId) {
      throw new ConflictError(
        'The voucher has no goods receipt to allocate against.',
      )
    }

    const receipt = await grnRepo.findGoodsReceiptById(
      tenantId,
      existing.goodsReceiptId,
      tx,
    )

    if (!receipt) {
      throw new NotFoundError('Goods receipt not found.')
    }

    const targets = receipt.lines.filter((line) =>
      line.acceptedQty.greaterThan(0),
    )

    if (targets.length === 0) {
      throw new ConflictError('The goods receipt has no accepted lines.')
    }

    const basis = existing.allocationBasis as AllocationBasis
    const weights =
      basis === 'weight'
        ? await loadWeights(tenantId, targets, tx)
        : new Map<string, Prisma.Decimal>()
    const manualByLine = new Map(
      (input.manualBasis ?? []).map((row) => [
        row.goodsReceiptLineId,
        row.basisValue,
      ]),
    )

    const rows = allocateLandedCost(
      basis,
      existing.totalCharges,
      targets.map((line) => ({
        key: line.id,
        quantity: line.acceptedQty,
        unitCost: line.unitCost,
        weightPerUnit: line.variantId
          ? (weights.get(`v:${line.variantId}`) ??
            weights.get(`p:${line.productId}`) ??
            null)
          : (weights.get(`p:${line.productId}`) ?? null),
        manualBasisValue: manualByLine.get(line.id) ?? null,
      })),
    )

    const lineById = new Map(targets.map((line) => [line.id, line]))

    await voucherRepo.replaceAllocations(
      tenantId,
      id,
      rows.map((row) => ({
        goodsReceiptLineId: row.key,
        purchaseOrderLineId: lineById.get(row.key)?.purchaseOrderLineId ?? null,
        productId: lineById.get(row.key)?.productId ?? null,
        basisValue: row.basisValue,
        allocatedAmount: row.allocatedAmount,
      })),
      tx,
    )

    if (existing.statusCode === 'draft') {
      await assertPodTransition(
        tenantId,
        'landed_cost',
        'draft',
        'allocated',
        tx,
      )
      await voucherRepo.updateVoucherStatus(
        tenantId,
        id,
        'allocated',
        context.profileId,
        tx,
      )
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.landed_cost_allocate',
        entityType: 'pod_landed_cost_voucher',
        entityId: id,
        newValues: { basis, rows: rows.length },
      },
      tx,
    )

    return (await voucherRepo.findVoucherById(tenantId, id, tx))!
  })

  return serializeLandedCostVoucher(voucher)
}

// Posting folds each allocation into inventory cost: the receipt line's
// PURCHASE_RECEIPT movements absorb the allocated value (weighted-average
// revaluation via the movement engine) and the matching FIFO cost layers get
// their landed_cost_per_unit bumped. Residuals that cannot be absorbed (stock
// already issued) stay visible on the zero-qty movement rows.
export async function postLandedCostVoucher(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const voucher = await prisma.$transaction(async (tx) => {
    const existing = await voucherRepo.findVoucherById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Landed-cost voucher not found.')
    }

    await assertPodTransition(
      tenantId,
      'landed_cost',
      existing.statusCode,
      'posted',
      tx,
    )

    if (existing.allocations.length === 0) {
      throw new ConflictError('Allocate the voucher before posting it.')
    }

    for (const allocation of existing.allocations) {
      if (
        !allocation.goodsReceiptLineId ||
        allocation.allocatedAmount.isZero()
      ) {
        continue
      }

      const movements = await tx.inventoryMovement.findMany({
        where: {
          tenantId,
          sourceDocType: 'GOODS_RECEIPT',
          sourceDocLineId: allocation.goodsReceiptLineId,
          movementType: 'PURCHASE_RECEIPT',
        },
        select: {
          id: true,
          productId: true,
          variantId: true,
          warehouseId: true,
          locationId: true,
          lotId: true,
          serialId: true,
          uomId: true,
          qtyInBaseUom: true,
        },
      })

      if (movements.length === 0) {
        throw new ConflictError(
          'The goods receipt has not been posted to inventory yet — post it before applying landed cost.',
        )
      }

      // Serial-tracked lines receive as many qty-1 movements; spread the line's
      // allocation across them by received quantity, exact-sum.
      const shares = allocateProRata(
        allocation.allocatedAmount,
        movements.map((movement) => ({
          key: movement.id,
          basisValue: movement.qtyInBaseUom,
        })),
      )
      const shareByMovement = new Map(
        shares.map((share) => [share.key, share.allocatedAmount]),
      )

      for (const movement of movements) {
        const share = shareByMovement.get(movement.id)

        if (!share || share.isZero()) {
          continue
        }

        await postValueAdjustment(tx, {
          tenantId,
          productId: movement.productId,
          variantId: movement.variantId,
          warehouseId: movement.warehouseId,
          locationId: movement.locationId,
          lotId: movement.lotId,
          serialId: movement.serialId,
          movementType: 'LANDED_COST_ADJUSTMENT',
          valueDelta: share,
          uomId: movement.uomId,
          sourceDocType: 'ADJUSTMENT',
          sourceDocId: id,
          sourceDocLineId: allocation.id,
          sourceDocNumber: existing.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: existing.correlationId,
          notes: `Landed cost ${existing.documentNumber}`,
        })

        await tx.costLayer.updateMany({
          where: { tenantId, sourceMovementId: movement.id },
          data: {
            landedCostPerUnit: {
              increment: share
                .dividedBy(movement.qtyInBaseUom)
                .toDecimalPlaces(6),
            },
          },
        })
      }
    }

    await voucherRepo.markVoucherPosted(tenantId, id, context.profileId, tx)

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'landed_cost.posted',
      aggregateType: 'pod_landed_cost_voucher',
      aggregateId: id,
      actorProfileId: context.profileId,
      payload: {
        documentNumber: existing.documentNumber,
        totalCharges: existing.totalCharges.toString(),
        allocationBasis: existing.allocationBasis,
      },
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.landed_cost_post',
        entityType: 'pod_landed_cost_voucher',
        entityId: id,
        newValues: { totalCharges: existing.totalCharges.toString() },
      },
      tx,
    )

    return (await voucherRepo.findVoucherById(tenantId, id, tx))!
  })

  return serializeLandedCostVoucher(voucher)
}

export async function cancelLandedCostVoucher(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const voucher = await prisma.$transaction(async (tx) => {
    const existing = await voucherRepo.findVoucherById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Landed-cost voucher not found.')
    }

    await assertPodTransition(
      tenantId,
      'landed_cost',
      existing.statusCode,
      'cancelled',
      tx,
    )

    await voucherRepo.updateVoucherStatus(
      tenantId,
      id,
      'cancelled',
      context.profileId,
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.landed_cost_cancel',
        entityType: 'pod_landed_cost_voucher',
        entityId: id,
        newValues: { statusCode: 'cancelled' },
      },
      tx,
    )

    return (await voucherRepo.findVoucherById(tenantId, id, tx))!
  })

  return serializeLandedCostVoucher(voucher)
}

export async function listLandedCostVouchers(
  _context: CurrentUserContext,
  tenantId: string,
  options: { statusCode?: string; goodsReceiptId?: string } = {},
) {
  const vouchers = await voucherRepo.listVouchers(tenantId, options)

  return vouchers.map(serializeLandedCostVoucher)
}

export async function getLandedCostVoucher(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const voucher = await voucherRepo.findVoucherById(tenantId, id)

  if (!voucher) {
    throw new NotFoundError('Landed-cost voucher not found.')
  }

  return serializeLandedCostVoucher(voucher)
}
