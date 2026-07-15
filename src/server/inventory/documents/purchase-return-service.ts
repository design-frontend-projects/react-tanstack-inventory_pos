import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializePurchaseReturn } from '#/server/inventory/document-dto'
import { postMovement } from '#/server/inventory/movement-engine'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as returnRepo from '#/server/repos/purchase-return-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface CreatePurchaseReturnInput {
  supplierId: string
  warehouseId: string
  purchaseOrderId?: string | null
  reason?: string | null
  lines: Array<returnRepo.PurchaseReturnLineInput>
}

export async function createPurchaseReturn(
  context: CurrentUserContext,
  tenantId: string,
  input: CreatePurchaseReturnInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A purchase return requires at least one line.')
  }

  const purchaseReturn = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'PURCHASE_RETURN',
    })

    const created = await returnRepo.createPurchaseReturn(
      tenantId,
      {
        documentNumber,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        reason: input.reason ?? null,
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
        actionKey: 'purchase.return_create',
        entityType: 'purchase_return',
        entityId: created.id,
        newValues: { documentNumber },
      },
      tx
    )

    return created
  })

  return serializePurchaseReturn(purchaseReturn)
}

// Posting ships goods back to the supplier: a PURCHASE_RETURN issue per line
// (valued at the given cost, or current WAC when omitted), reducing stock.
export async function postPurchaseReturn(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const posted = await prisma.$transaction(
    async (tx) => {
      const purchaseReturn = await returnRepo.findPurchaseReturnById(tenantId, id, tx)

      if (!purchaseReturn) {
        throw new NotFoundError('Purchase return not found.')
      }

      if (purchaseReturn.isPosted) {
        throw new ConflictError('Purchase return is already posted.')
      }

      assertTransition('purchaseReturn', purchaseReturn.status.toLowerCase(), 'shipped')

      for (const line of purchaseReturn.lines) {
        const qty = new Prisma.Decimal(line.quantity)

        if (qty.lte(0)) {
          continue
        }

        await postMovement(tx, {
          tenantId,
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: purchaseReturn.warehouseId,
          locationId: line.fromLocationId,
          lotId: line.lotId,
          serialId: line.serialId,
          movementType: 'PURCHASE_RETURN',
          direction: 'OUT',
          quantity: qty,
          uomId: line.uomId,
          unitCost: line.unitCost ? new Prisma.Decimal(line.unitCost) : null,
          sourceDocType: 'RETURN',
          sourceDocId: purchaseReturn.id,
          sourceDocLineId: line.id,
          sourceDocNumber: purchaseReturn.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: purchaseReturn.correlationId ?? undefined,
        })
      }

      await returnRepo.markReturnPosted(tenantId, id, context.profileId, 'SHIPPED', tx)

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'purchase.return_post',
          entityType: 'purchase_return',
          entityId: purchaseReturn.id,
          newValues: { documentNumber: purchaseReturn.documentNumber },
        },
        tx
      )

      const refreshed = await returnRepo.findPurchaseReturnById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000 }
  )

  return serializePurchaseReturn(posted)
}

export function listPurchaseReturns(_context: CurrentUserContext, tenantId: string) {
  return returnRepo.listPurchaseReturns(tenantId, {})
}

export async function getPurchaseReturn(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const purchaseReturn = await returnRepo.findPurchaseReturnById(tenantId, id)

  if (!purchaseReturn) {
    throw new NotFoundError('Purchase return not found.')
  }

  return serializePurchaseReturn(purchaseReturn)
}
