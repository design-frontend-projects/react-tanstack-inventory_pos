import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeAdjustment } from '#/server/inventory/inventory-dto'
import { postMovement } from '#/server/inventory/movement-engine'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type {
  AdjustmentReason,
  MovementType,
} from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as adjustmentRepo from '#/server/repos/stock-adjustment-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface CreateAdjustmentInput {
  warehouseId: string
  reasonCode: AdjustmentReason
  notes?: string | null
  lines: Array<adjustmentRepo.AdjustmentLineInput>
}

// Draft creation is transactional so the document number and the header/lines
// commit together.
export async function createAdjustment(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateAdjustmentInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('An adjustment requires at least one line.')
  }

  const adjustment = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'STOCK_ADJUSTMENT',
    })

    const created = await adjustmentRepo.createAdjustment(
      tenantId,
      {
        documentNumber,
        warehouseId: input.warehouseId,
        reasonCode: input.reasonCode,
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
        actionKey: 'adjustment.create',
        entityType: 'stock_adjustment',
        entityId: created.id,
        newValues: { documentNumber, lineCount: input.lines.length },
      },
      tx
    )

    return created
  })

  return serializeAdjustment(adjustment)
}

function resolveMovement(
  reason: AdjustmentReason,
  qtyDelta: Prisma.Decimal
): { movementType: MovementType; direction: 'IN' | 'OUT' } {
  const direction = qtyDelta.gte(0) ? 'IN' : 'OUT'

  switch (reason) {
    case 'DAMAGE':
      return { movementType: 'DAMAGE', direction: 'OUT' }
    case 'EXPIRY':
      return { movementType: 'EXPIRED', direction: 'OUT' }
    case 'LOSS':
      return { movementType: 'LOST', direction: 'OUT' }
    default:
      return {
        movementType: direction === 'IN' ? 'ADJUSTMENT_INC' : 'ADJUSTMENT_DEC',
        direction,
      }
  }
}

// Posts the adjustment: within ONE transaction it validates the lifecycle
// transition, posts a movement per line through the engine (which updates the
// balance under lock), then marks the document posted. Any failure rolls back the
// whole document — stock is never left half-applied.
export async function postAdjustment(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const posted = await prisma.$transaction(
    async (tx) => {
      const adjustment = await adjustmentRepo.findAdjustmentById(tenantId, id, tx)

      if (!adjustment) {
        throw new NotFoundError('Adjustment not found.')
      }

      assertTransition('stockAdjustment', adjustment.status.toLowerCase(), 'posted')

      const correlationId = adjustment.correlationId ?? undefined

      for (const line of adjustment.lines) {
        const qtyDelta = new Prisma.Decimal(line.qtyDelta)

        if (qtyDelta.eq(0)) {
          continue
        }

        const { movementType, direction } = resolveMovement(
          adjustment.reasonCode,
          qtyDelta
        )

        await postMovement(tx, {
          tenantId,
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: adjustment.warehouseId,
          locationId: line.locationId,
          lotId: line.lotId,
          serialId: line.serialId,
          movementType,
          direction,
          quantity: qtyDelta.abs(),
          uomId: line.uomId,
          unitCost: line.unitCost ? new Prisma.Decimal(line.unitCost) : null,
          sourceDocType: 'ADJUSTMENT',
          sourceDocId: adjustment.id,
          sourceDocLineId: line.id,
          sourceDocNumber: adjustment.documentNumber,
          performedByProfileId: context.profileId,
          correlationId,
        })
      }

      await adjustmentRepo.updateAdjustmentStatus(
        tenantId,
        id,
        'POSTED',
        {
          isPosted: true,
          postedAt: new Date(),
          postedByProfileId: context.profileId,
        },
        tx
      )

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'adjustment.post',
          entityType: 'stock_adjustment',
          entityId: adjustment.id,
          newValues: { documentNumber: adjustment.documentNumber },
        },
        tx
      )

      const refreshed = await adjustmentRepo.findAdjustmentById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20_000 }
  )

  return serializeAdjustment(posted)
}

export function listAdjustments(_context: CurrentUserContext, tenantId: string) {
  return adjustmentRepo.listAdjustments(tenantId, {})
}

export async function getAdjustment(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const adjustment = await adjustmentRepo.findAdjustmentById(tenantId, id)

  if (!adjustment) {
    throw new NotFoundError('Adjustment not found.')
  }

  return serializeAdjustment(adjustment)
}
