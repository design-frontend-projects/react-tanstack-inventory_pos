import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeRequisition } from '#/server/inventory/document-dto'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as poRepo from '#/server/repos/purchase-order-repo'
import * as requisitionRepo from '#/server/repos/purchase-requisition-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface CreateRequisitionInput {
  warehouseId?: string | null
  notes?: string | null
  lines: Array<requisitionRepo.RequisitionLineInput>
}

export async function createRequisition(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateRequisitionInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A requisition requires at least one line.')
  }

  const requisition = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'PURCHASE_REQUISITION',
    })

    const created = await requisitionRepo.createRequisition(
      tenantId,
      {
        documentNumber,
        warehouseId: input.warehouseId ?? null,
        notes: input.notes ?? null,
        requestedByProfileId: context.profileId,
        lines: input.lines,
      },
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.requisition_create',
        entityType: 'purchase_requisition',
        entityId: created.id,
        newValues: { documentNumber },
      },
      tx
    )

    return created
  })

  return serializeRequisition(requisition)
}

async function transitionRequisition(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  target: 'submitted' | 'approved',
  actionKey: string
) {
  const requisition = await requisitionRepo.findRequisitionById(tenantId, id)

  if (!requisition) {
    throw new NotFoundError('Requisition not found.')
  }

  assertTransition('purchaseRequisition', requisition.status.toLowerCase(), target)

  await requisitionRepo.updateRequisitionStatus(
    tenantId,
    id,
    target === 'submitted' ? 'SUBMITTED' : 'APPROVED',
    target === 'approved' ? { approvedByProfileId: context.profileId } : {}
  )

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType: 'purchase_requisition',
    entityId: id,
  })

  const refreshed = await requisitionRepo.findRequisitionById(tenantId, id)

  return serializeRequisition(refreshed!)
}

export function submitRequisition(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionRequisition(context, tenantId, id, 'submitted', 'purchase.requisition_submit')
}

export function approveRequisition(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionRequisition(context, tenantId, id, 'approved', 'purchase.requisition_approve')
}

// Converts an APPROVED requisition into a DRAFT purchase order (unit costs seeded
// to zero for the buyer to price), then marks the requisition converted.
export async function convertRequisitionToPurchaseOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: { supplierId: string; warehouseId: string }
) {
  return prisma.$transaction(async (tx) => {
    const requisition = await requisitionRepo.findRequisitionById(tenantId, id, tx)

    if (!requisition) {
      throw new NotFoundError('Requisition not found.')
    }

    assertTransition('purchaseRequisition', requisition.status.toLowerCase(), 'converted')

    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'PURCHASE_ORDER',
    })

    const po = await poRepo.createPurchaseOrder(
      tenantId,
      {
        documentNumber,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        subtotal: new Prisma.Decimal(0),
        taxTotal: new Prisma.Decimal(0),
        grandTotal: new Prisma.Decimal(0),
        requisitionId: requisition.id,
        createdByProfileId: context.profileId,
        lines: requisition.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          uomId: line.uomId,
          orderedQty: line.quantity,
          unitCost: new Prisma.Decimal(0),
          lineTotal: new Prisma.Decimal(0),
        })),
      },
      tx
    )

    await requisitionRepo.updateRequisitionStatus(
      tenantId,
      id,
      'CONVERTED',
      { convertedToPoId: po.id },
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.requisition_convert',
        entityType: 'purchase_requisition',
        entityId: id,
        newValues: { purchaseOrderId: po.id, purchaseOrderNumber: documentNumber },
      },
      tx
    )

    return { requisitionId: id, purchaseOrderId: po.id, purchaseOrderNumber: documentNumber }
  })
}

export function listRequisitions(_context: CurrentUserContext, tenantId: string) {
  return requisitionRepo.listRequisitions(tenantId, {})
}

export async function getRequisition(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const requisition = await requisitionRepo.findRequisitionById(tenantId, id)

  if (!requisition) {
    throw new NotFoundError('Requisition not found.')
  }

  return serializeRequisition(requisition)
}
