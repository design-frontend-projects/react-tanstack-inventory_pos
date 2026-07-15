import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeGoodsReceipt } from '#/server/inventory/document-dto'
import { createSerial, ensureLot } from '#/server/inventory/lot-serial-service'
import { postMovement } from '#/server/inventory/movement-engine'
import { requiresSerial } from '#/server/inventory/tracking-policy'
import { assertTransition, canTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { Prisma as PrismaNS } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as goodsReceiptRepo from '#/server/repos/goods-receipt-repo'
import { getProductTracking } from '#/server/repos/product-repo'
import * as poRepo from '#/server/repos/purchase-order-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface CreateGoodsReceiptInput {
  purchaseOrderId?: string | null
  supplierId: string
  warehouseId: string
  supplierDeliveryNote?: string | null
  lines: Array<goodsReceiptRepo.GoodsReceiptLineInput>
}

export async function createGoodsReceipt(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateGoodsReceiptInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A goods receipt requires at least one line.')
  }

  const receipt = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'GOODS_RECEIPT',
    })

    const created = await goodsReceiptRepo.createGoodsReceipt(
      tenantId,
      {
        documentNumber,
        purchaseOrderId: input.purchaseOrderId ?? null,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        supplierDeliveryNote: input.supplierDeliveryNote ?? null,
        createdByProfileId: context.profileId,
        lines: input.lines,
      },
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.receipt_create',
        entityType: 'goods_receipt',
        entityId: created.id,
        newValues: { documentNumber },
      },
      tx
    )

    return created
  })

  return serializeGoodsReceipt(receipt)
}

// Reconcile the parent PO's status from its lines' received vs ordered quantities.
async function reconcilePurchaseOrder(
  tenantId: string,
  purchaseOrderId: string,
  tx: PrismaNS.TransactionClient
) {
  const po = await poRepo.findPurchaseOrderById(tenantId, purchaseOrderId, tx)

  if (!po) {
    return
  }

  const fullyReceived = po.lines.every((line) =>
    new Prisma.Decimal(line.receivedQty).gte(new Prisma.Decimal(line.orderedQty))
  )
  const target = fullyReceived ? 'received' : 'partially_received'

  if (canTransition('purchaseOrder', po.status.toLowerCase(), target)) {
    await poRepo.updatePurchaseOrderStatus(
      tenantId,
      purchaseOrderId,
      target === 'received' ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
      {},
      tx
    )
  }
}

// Posting the receipt is the inventory-increasing event: a PURCHASE_RECEIPT
// movement per accepted line (valued at the receipt unit cost), the PO line
// received quantities incremented, and the PO status reconciled — atomically.
export async function postGoodsReceipt(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const posted = await prisma.$transaction(
    async (tx) => {
      const receipt = await goodsReceiptRepo.findGoodsReceiptById(tenantId, id, tx)

      if (!receipt) {
        throw new NotFoundError('Goods receipt not found.')
      }

      if (receipt.isPosted) {
        throw new ConflictError('Goods receipt is already posted.')
      }

      assertTransition('goodsReceipt', receipt.status.toLowerCase(), 'completed')

      for (const line of receipt.lines) {
        const acceptedQty = new Prisma.Decimal(line.acceptedQty)

        if (acceptedQty.lte(0)) {
          continue
        }

        const tracking = await getProductTracking(tenantId, line.productId, tx)
        const policy = tracking?.trackingPolicy ?? 'NONE'

        // Lot-tracked lines materialize (or reuse) a Lot for the received batch.
        let lotId: string | null = null

        if ((policy === 'LOT' || policy === 'LOT_SERIAL') && line.lotNumber) {
          const lot = await ensureLot(tx, tenantId, {
            productId: line.productId,
            variantId: line.variantId,
            lotNumber: line.lotNumber,
            expiryDate: line.expiryDate,
            receivedDate: receipt.receiptDate,
            supplierId: receipt.supplierId,
            initialQty: acceptedQty,
            sourceDocType: 'GOODS_RECEIPT',
            sourceDocId: receipt.id,
          })
          lotId = lot.id
        }

        if (requiresSerial(policy)) {
          // Serialized receipt: one Lot-linked SerialNumber + one qty-1 movement
          // per serial. Guard the count against the accepted quantity.
          const serials = line.serialNumbers

          if (new Prisma.Decimal(serials.length).lt(acceptedQty)) {
            throw new ConflictError(
              `Line ${line.lineNo}: ${serials.length} serial number(s) for ${acceptedQty.toString()} accepted units.`
            )
          }

          for (const serialNumber of serials) {
            const serial = await createSerial(tx, tenantId, {
              productId: line.productId,
              variantId: line.variantId,
              serialNumber,
              status: 'IN_STOCK',
              currentWarehouseId: receipt.warehouseId,
              currentLocationId: line.toLocationId,
              lotId,
              supplierId: receipt.supplierId,
              sourceDocType: 'GOODS_RECEIPT',
              sourceDocId: receipt.id,
            })

            await postMovement(tx, {
              tenantId,
              productId: line.productId,
              variantId: line.variantId,
              warehouseId: receipt.warehouseId,
              locationId: line.toLocationId,
              lotId,
              serialId: serial.id,
              movementType: 'PURCHASE_RECEIPT',
              direction: 'IN',
              quantity: 1,
              uomId: line.uomId,
              unitCost: new Prisma.Decimal(line.unitCost),
              sourceDocType: 'GOODS_RECEIPT',
              sourceDocId: receipt.id,
              sourceDocLineId: line.id,
              sourceDocNumber: receipt.documentNumber,
              performedByProfileId: context.profileId,
              correlationId: receipt.correlationId ?? undefined,
              trackingPolicy: policy,
            })
          }
        } else {
          await postMovement(tx, {
            tenantId,
            productId: line.productId,
            variantId: line.variantId,
            warehouseId: receipt.warehouseId,
            locationId: line.toLocationId,
            lotId,
            movementType: 'PURCHASE_RECEIPT',
            direction: 'IN',
            quantity: acceptedQty,
            uomId: line.uomId,
            unitCost: new Prisma.Decimal(line.unitCost),
            sourceDocType: 'GOODS_RECEIPT',
            sourceDocId: receipt.id,
            sourceDocLineId: line.id,
            sourceDocNumber: receipt.documentNumber,
            performedByProfileId: context.profileId,
            correlationId: receipt.correlationId ?? undefined,
            trackingPolicy: policy,
          })
        }

        if (line.purchaseOrderLineId) {
          await poRepo.incrementLineReceivedQty(line.purchaseOrderLineId, acceptedQty, tx)
        }
      }

      await goodsReceiptRepo.markReceiptPosted(tenantId, id, context.profileId, 'COMPLETED', tx)

      if (receipt.purchaseOrderId) {
        await reconcilePurchaseOrder(tenantId, receipt.purchaseOrderId, tx)
      }

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'purchase.receipt_post',
          entityType: 'goods_receipt',
          entityId: receipt.id,
          newValues: { documentNumber: receipt.documentNumber },
        },
        tx
      )

      const refreshed = await goodsReceiptRepo.findGoodsReceiptById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeGoodsReceipt(posted)
}

export function listGoodsReceipts(_context: CurrentUserContext, tenantId: string) {
  return goodsReceiptRepo.listGoodsReceipts(tenantId, {})
}

export async function getGoodsReceipt(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const receipt = await goodsReceiptRepo.findGoodsReceiptById(tenantId, id)

  if (!receipt) {
    throw new NotFoundError('Goods receipt not found.')
  }

  return serializeGoodsReceipt(receipt)
}
