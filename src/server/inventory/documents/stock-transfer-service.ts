import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeTransfer } from '#/server/inventory/document-dto'
import { postMovement } from '#/server/inventory/movement-engine'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import { findDocLineMovement } from '#/server/repos/movement-repo'
import * as transferRepo from '#/server/repos/stock-transfer-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface CreateTransferInput {
  fromWarehouseId: string
  toWarehouseId: string
  notes?: string | null
  lines: Array<transferRepo.TransferLineInput>
}

export async function createTransfer(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateTransferInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A transfer requires at least one line.')
  }

  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new ConflictError('Source and destination warehouses must differ.')
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'STOCK_TRANSFER',
    })

    const created = await transferRepo.createTransfer(
      tenantId,
      {
        documentNumber,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        notes: input.notes ?? null,
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
        actionKey: 'transfer.create',
        entityType: 'stock_transfer',
        entityId: created.id,
        newValues: { documentNumber },
      },
      tx
    )

    return created
  })

  return serializeTransfer(transfer)
}

// Ship: posts a TRANSFER_OUT from the source location per line (issue at source
// WAC), records shipped qty, and moves the document into transit.
export async function shipTransfer(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const shipped = await prisma.$transaction(
    async (tx) => {
      const transfer = await transferRepo.findTransferById(tenantId, id, tx)

      if (!transfer) {
        throw new NotFoundError('Transfer not found.')
      }

      assertTransition('stockTransfer', transfer.status.toLowerCase(), 'shipped')

      for (const line of transfer.lines) {
        const qty = new Prisma.Decimal(line.requestedQty)

        if (qty.lte(0)) {
          continue
        }

        await postMovement(tx, {
          tenantId,
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: transfer.fromWarehouseId,
          locationId: line.fromLocationId,
          counterpartyLocationId: line.toLocationId,
          lotId: line.lotId,
          serialId: line.serialId,
          movementType: 'TRANSFER_OUT',
          direction: 'OUT',
          quantity: qty,
          uomId: line.uomId,
          sourceDocType: 'TRANSFER',
          sourceDocId: transfer.id,
          sourceDocLineId: line.id,
          sourceDocNumber: transfer.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: transfer.correlationId ?? undefined,
        })

        await transferRepo.setLineShippedQty(line.id, qty, tx)
      }

      await transferRepo.updateTransferStatus(
        tenantId,
        id,
        'IN_TRANSIT',
        { shipDate: new Date(), shippedByProfileId: context.profileId },
        tx
      )

      const refreshed = await transferRepo.findTransferById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000 }
  )

  return serializeTransfer(shipped)
}

// Receive: posts a TRANSFER_IN at the destination for each line, valued at the
// cost its TRANSFER_OUT leg was issued at, so value is conserved across the move.
export async function receiveTransfer(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const received = await prisma.$transaction(
    async (tx) => {
      const transfer = await transferRepo.findTransferById(tenantId, id, tx)

      if (!transfer) {
        throw new NotFoundError('Transfer not found.')
      }

      assertTransition('stockTransfer', transfer.status.toLowerCase(), 'received')

      for (const line of transfer.lines) {
        const qty = new Prisma.Decimal(line.shippedQty)

        if (qty.lte(0)) {
          continue
        }

        const outLeg = await findDocLineMovement(
          tenantId,
          transfer.id,
          line.id,
          'TRANSFER_OUT',
          tx
        )

        const unitCost = outLeg ? new Prisma.Decimal(outLeg.unitCost) : null

        await postMovement(tx, {
          tenantId,
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: transfer.toWarehouseId,
          locationId: line.toLocationId,
          counterpartyLocationId: line.fromLocationId,
          lotId: line.lotId,
          serialId: line.serialId,
          movementType: 'TRANSFER_IN',
          direction: 'IN',
          quantity: qty,
          uomId: line.uomId,
          unitCost,
          sourceDocType: 'TRANSFER',
          sourceDocId: transfer.id,
          sourceDocLineId: line.id,
          sourceDocNumber: transfer.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: transfer.correlationId ?? undefined,
        })

        await transferRepo.setLineReceivedQty(line.id, qty, tx)
      }

      await transferRepo.updateTransferStatus(
        tenantId,
        id,
        'RECEIVED',
        { receiveDate: new Date(), receivedByProfileId: context.profileId },
        tx
      )

      const refreshed = await transferRepo.findTransferById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000 }
  )

  return serializeTransfer(received)
}

export function listTransfers(_context: CurrentUserContext, tenantId: string) {
  return transferRepo.listTransfers(tenantId, {})
}

export async function getTransfer(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const transfer = await transferRepo.findTransferById(tenantId, id)

  if (!transfer) {
    throw new NotFoundError('Transfer not found.')
  }

  return serializeTransfer(transfer)
}
