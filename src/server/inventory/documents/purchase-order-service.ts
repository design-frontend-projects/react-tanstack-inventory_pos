import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializePurchaseOrder } from '#/server/inventory/document-dto'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as poRepo from '#/server/repos/purchase-order-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface PurchaseOrderLineDraft {
  productId: string
  variantId?: string | null
  uomId: string
  orderedQty: Prisma.Decimal | string | number
  unitCost: Prisma.Decimal | string | number
  taxRateId?: string | null
  expectedDate?: Date | null
}

export interface CreatePurchaseOrderInput {
  supplierId: string
  warehouseId: string
  expectedDate?: Date | null
  currencyCode?: string
  notes?: string | null
  paymentTerms?: string | null
  requisitionId?: string | null
  lines: Array<PurchaseOrderLineDraft>
}

// A purchase order never affects inventory — it only records intent. Inventory
// moves when the goods receipt is posted. The service computes line totals and
// header totals from qty * cost (tax computation is layered in later).
export async function createPurchaseOrder(
  context: CurrentUserContext,
  tenantId: string,
  input: CreatePurchaseOrderInput,
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A purchase order requires at least one line.')
  }

  let subtotal = new Prisma.Decimal(0)

  const lines = input.lines.map((line) => {
    const qty = new Prisma.Decimal(line.orderedQty)
    const cost = new Prisma.Decimal(line.unitCost)
    const lineTotal = qty.times(cost)
    subtotal = subtotal.plus(lineTotal)

    return {
      productId: line.productId,
      variantId: line.variantId ?? null,
      uomId: line.uomId,
      orderedQty: qty,
      unitCost: cost,
      taxRateId: line.taxRateId ?? null,
      taxAmount: new Prisma.Decimal(0),
      lineTotal,
      expectedDate: line.expectedDate ?? null,
    }
  })

  const po = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'PURCHASE_ORDER',
    })

    const created = await poRepo.createPurchaseOrder(
      tenantId,
      {
        documentNumber,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        expectedDate: input.expectedDate ?? null,
        currencyCode: input.currencyCode ?? 'USD',
        subtotal,
        taxTotal: new Prisma.Decimal(0),
        grandTotal: subtotal,
        notes: input.notes ?? null,
        paymentTerms: input.paymentTerms ?? null,
        requisitionId: input.requisitionId ?? null,
        createdByProfileId: context.profileId,
        lines,
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.po_create',
        entityType: 'purchase_order',
        entityId: created.id,
        newValues: { documentNumber, grandTotal: subtotal.toString() },
      },
      tx,
    )

    return created
  })

  return serializePurchaseOrder(po)
}

async function transitionPurchaseOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  target: 'approved' | 'confirmed' | 'cancelled',
  actionKey: string,
) {
  const po = await poRepo.findPurchaseOrderById(tenantId, id)

  if (!po) {
    throw new NotFoundError('Purchase order not found.')
  }

  assertTransition('purchaseOrder', po.status.toLowerCase(), target)

  const statusValue = target.toUpperCase() as
    | 'APPROVED'
    | 'CONFIRMED'
    | 'CANCELLED'

  await poRepo.updatePurchaseOrderStatus(
    tenantId,
    id,
    statusValue,
    target === 'approved' ? { approvedByProfileId: context.profileId } : {},
  )

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType: 'purchase_order',
    entityId: id,
  })

  const refreshed = await poRepo.findPurchaseOrderById(tenantId, id)

  return serializePurchaseOrder(refreshed!)
}

export function approvePurchaseOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionPurchaseOrder(
    context,
    tenantId,
    id,
    'approved',
    'purchase.po_approve',
  )
}

export function confirmPurchaseOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionPurchaseOrder(
    context,
    tenantId,
    id,
    'confirmed',
    'purchase.po_confirm',
  )
}

export function cancelPurchaseOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionPurchaseOrder(
    context,
    tenantId,
    id,
    'cancelled',
    'purchase.po_cancel',
  )
}

export async function listPurchaseOrders(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const orders = await poRepo.listPurchaseOrders(tenantId, {})

  return orders.map((po) => ({
    ...po,
    subtotal: po.subtotal.toString(),
    taxTotal: po.taxTotal.toString(),
    grandTotal: po.grandTotal.toString(),
    // Spec 005 header extensions (Decimal → string for the wire)
    exchangeRate: po.exchangeRate.toString(),
    discountTotal: po.discountTotal.toString(),
  }))
}

export async function getPurchaseOrder(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const po = await poRepo.findPurchaseOrderById(tenantId, id)

  if (!po) {
    throw new NotFoundError('Purchase order not found.')
  }

  return serializePurchaseOrder(po)
}
