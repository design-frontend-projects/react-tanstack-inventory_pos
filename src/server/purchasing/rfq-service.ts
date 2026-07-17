import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createPurchaseOrder } from '#/server/inventory/documents/purchase-order-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as rfqRepo from '#/server/repos/pod-rfq-repo'
import * as quotationRepo from '#/server/repos/pod-supplier-quotation-repo'
import { buildComparisonMatrix } from '#/server/purchasing/comparison-matrix'
import { assertPodTransition } from '#/server/purchasing/pod-status-service'
import {
  serializeQuotation,
  serializeRfq,
} from '#/server/purchasing/sourcing-dto'
import type { CurrentUserContext } from '#/types/auth'
import type { Prisma } from '#/server/db/generated/prisma/client'

export interface CreateRfqInput {
  title?: string | null
  requisitionId?: string | null
  warehouseId?: string | null
  currencyCode?: string
  expiryDate?: Date | null
  notes?: string | null
  items: Array<{
    productId: string
    variantId?: string | null
    uomId: string
    quantity: Prisma.Decimal | string | number
    requiredDate?: Date | null
    specification?: string | null
    notes?: string | null
  }>
  supplierIds: Array<string>
}

// An RFQ is issued the moment it is created (seeded initial status: `open`) and
// invited suppliers are notified through the `rfq.issued` outbox event.
export async function createRfq(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateRfqInput,
) {
  if (input.items.length === 0) {
    throw new ConflictError('An RFQ requires at least one item.')
  }

  const supplierIds = Array.from(new Set(input.supplierIds))

  if (supplierIds.length === 0) {
    throw new ConflictError('An RFQ requires at least one invited supplier.')
  }

  const rfq = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'RFQ',
    })

    const created = await rfqRepo.createRfq(
      tenantId,
      {
        documentNumber,
        title: input.title ?? null,
        requisitionId: input.requisitionId ?? null,
        warehouseId: input.warehouseId ?? null,
        currencyCode: input.currencyCode ?? 'USD',
        expiryDate: input.expiryDate ?? null,
        buyerProfileId: context.profileId,
        notes: input.notes ?? null,
        createdBy: context.profileId,
        items: input.items,
        supplierIds,
      },
      tx,
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'rfq.issued',
      aggregateType: 'pod_rfq',
      aggregateId: created.id,
      actorProfileId: context.profileId,
      payload: { documentNumber, supplierCount: supplierIds.length },
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.rfq_create',
        entityType: 'pod_rfq',
        entityId: created.id,
        newValues: { documentNumber, supplierCount: supplierIds.length },
      },
      tx,
    )

    return created
  })

  return serializeRfq(rfq)
}

export async function reviseRfq(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: {
    title?: string | null
    expiryDate?: Date | null
    notes?: string | null
    items: CreateRfqInput['items']
  },
) {
  if (input.items.length === 0) {
    throw new ConflictError('An RFQ revision requires at least one item.')
  }

  const rfq = await prisma.$transaction(async (tx) => {
    const existing = await rfqRepo.findRfqById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('RFQ not found.')
    }

    if (existing.statusCode !== 'open') {
      throw new ConflictError('Only open RFQs can be revised.')
    }

    const revised = await rfqRepo.reviseRfq(
      tenantId,
      id,
      { ...input, updatedBy: context.profileId },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.rfq_revise',
        entityType: 'pod_rfq',
        entityId: id,
        newValues: { revision: revised!.revision },
      },
      tx,
    )

    return revised!
  })

  return serializeRfq(rfq)
}

async function closeRfq(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  toCode: 'cancelled' | 'expired',
  actionKey: string,
) {
  const rfq = await prisma.$transaction(async (tx) => {
    const existing = await rfqRepo.findRfqById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('RFQ not found.')
    }

    await assertPodTransition(tenantId, 'rfq', existing.statusCode, toCode, tx)
    await rfqRepo.updateRfqStatus(
      tenantId,
      id,
      toCode,
      { updatedBy: context.profileId },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey,
        entityType: 'pod_rfq',
        entityId: id,
        newValues: { statusCode: toCode },
      },
      tx,
    )

    return (await rfqRepo.findRfqById(tenantId, id, tx))!
  })

  return serializeRfq(rfq)
}

export function cancelRfq(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return closeRfq(context, tenantId, id, 'cancelled', 'purchase.rfq_cancel')
}

export function expireRfq(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return closeRfq(context, tenantId, id, 'expired', 'purchase.rfq_expire')
}

// Awards an approved quotation: quotation approved -> awarded, RFQ open ->
// awarded, and the winning supplier's invitation row is marked awarded.
export async function awardRfq(
  context: CurrentUserContext,
  tenantId: string,
  rfqId: string,
  input: { quotationId: string },
) {
  const rfq = await prisma.$transaction(async (tx) => {
    const existing = await rfqRepo.findRfqById(tenantId, rfqId, tx)

    if (!existing) {
      throw new NotFoundError('RFQ not found.')
    }

    const quotation = await quotationRepo.findQuotationById(
      tenantId,
      input.quotationId,
      tx,
    )

    if (!quotation || quotation.rfqId !== rfqId) {
      throw new NotFoundError('Quotation not found for this RFQ.')
    }

    await assertPodTransition(
      tenantId,
      'rfq',
      existing.statusCode,
      'awarded',
      tx,
    )
    await assertPodTransition(
      tenantId,
      'supplier_quotation',
      quotation.statusCode,
      'awarded',
      tx,
    )

    await quotationRepo.updateQuotationStatus(
      tenantId,
      quotation.id,
      'awarded',
      { updatedBy: context.profileId },
      tx,
    )

    await rfqRepo.updateRfqStatus(
      tenantId,
      rfqId,
      'awarded',
      {
        awardedSupplierId: quotation.supplierId,
        awardedQuotationId: quotation.id,
        updatedBy: context.profileId,
      },
      tx,
    )

    await rfqRepo.updateRfqSupplierStatus(
      tenantId,
      rfqId,
      quotation.supplierId,
      'awarded',
      {},
      tx,
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'rfq.awarded',
      aggregateType: 'pod_rfq',
      aggregateId: rfqId,
      actorProfileId: context.profileId,
      payload: {
        documentNumber: existing.documentNumber,
        awardedSupplierId: quotation.supplierId,
        awardedQuotationId: quotation.id,
      },
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.rfq_award',
        entityType: 'pod_rfq',
        entityId: rfqId,
        newValues: {
          quotationId: quotation.id,
          supplierId: quotation.supplierId,
        },
      },
      tx,
    )

    return (await rfqRepo.findRfqById(tenantId, rfqId, tx))!
  })

  return serializeRfq(rfq)
}

// Converts an awarded quotation into a DRAFT purchase order priced from the
// quotation lines. Delegates to the Spec-002 PO service (numbering, audit).
export async function convertQuotationToPurchaseOrder(
  context: CurrentUserContext,
  tenantId: string,
  quotationId: string,
  input: {
    warehouseId: string
    expectedDate?: Date | null
    notes?: string | null
  },
) {
  const quotation = await quotationRepo.findQuotationById(tenantId, quotationId)

  if (!quotation) {
    throw new NotFoundError('Quotation not found.')
  }

  if (quotation.statusCode !== 'awarded') {
    throw new ConflictError(
      'Only awarded quotations can be converted to a purchase order.',
    )
  }

  return createPurchaseOrder(context, tenantId, {
    supplierId: quotation.supplierId,
    warehouseId: input.warehouseId,
    expectedDate: input.expectedDate ?? null,
    currencyCode: quotation.currencyCode,
    notes: input.notes ?? `From quotation ${quotation.documentNumber}`,
    paymentTerms: quotation.paymentTerms,
    lines: quotation.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      uomId: item.uomId,
      orderedQty: item.quantity,
      unitCost: item.unitPrice,
      taxRateId: item.taxRateId,
    })),
  })
}

export async function listRfqs(
  _context: CurrentUserContext,
  tenantId: string,
  options: { statusCode?: string; supplierId?: string } = {},
) {
  const rfqs = await rfqRepo.listRfqs(tenantId, options)

  return rfqs.map(serializeRfq)
}

export async function getRfq(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const rfq = await rfqRepo.findRfqById(tenantId, id)

  if (!rfq) {
    throw new NotFoundError('RFQ not found.')
  }

  return serializeRfq(rfq)
}

// Comparison matrix: RFQ items as rows, one column per received quotation, with
// best-unit-price and best-complete-total flags for the award decision.
export async function getRfqComparison(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const rfq = await rfqRepo.findRfqById(tenantId, id)

  if (!rfq) {
    throw new NotFoundError('RFQ not found.')
  }

  const quotations = await quotationRepo.listQuotations(tenantId, { rfqId: id })
  const comparable = quotations.filter(
    (quotation) =>
      !['cancelled', 'rejected', 'expired'].includes(quotation.statusCode),
  )

  const serialized = comparable.map(serializeQuotation)

  return {
    rfq: serializeRfq(rfq),
    quotations: serialized,
    matrix: buildComparisonMatrix(
      serializeRfq(rfq).items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      serialized.map((quotation) => ({
        id: quotation.id,
        supplierId: quotation.supplierId,
        statusCode: quotation.statusCode,
        currencyCode: quotation.currencyCode,
        grandTotal: quotation.grandTotal,
        leadTimeDays: quotation.leadTimeDays,
        items: quotation.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          netAmount: item.netAmount,
          leadTimeDays: item.leadTimeDays,
        })),
      })),
    ),
  }
}
