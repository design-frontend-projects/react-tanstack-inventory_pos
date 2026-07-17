import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as rfqRepo from '#/server/repos/pod-rfq-repo'
import * as quotationRepo from '#/server/repos/pod-supplier-quotation-repo'
import * as supplierRepo from '#/server/repos/supplier-repo'
import { assertPodTransition } from '#/server/purchasing/pod-status-service'
import { serializeQuotation } from '#/server/purchasing/sourcing-dto'
import type { CurrentUserContext } from '#/types/auth'
import type { PrismaClientLike } from '#/server/db/types'

export interface QuotationLineDraft {
  productId: string
  variantId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discountPct?: Prisma.Decimal | string | number | null
  discountAmount?: Prisma.Decimal | string | number | null
  taxRateId?: string | null
  leadTimeDays?: number | null
  notes?: string | null
}

export interface RecordQuotationInput {
  rfqId?: string | null
  supplierId: string
  quotationDate?: Date | null
  validUntil?: Date | null
  currencyCode?: string
  exchangeRate?: string | number | null
  leadTimeDays?: number | null
  paymentTerms?: string | null
  freightAmount?: string | number | null
  insuranceAmount?: string | number | null
  remarks?: string | null
  lines: Array<QuotationLineDraft>
}

// Pure line math (unit-testable). Convention:
//   gross    = quantity * unitPrice
//   discount = explicit discountAmount, else gross * discountPct (fraction)
//   net      = gross - discount            (stored as net_amount, excl. tax)
//   tax      = net * taxRate               (TaxRate.rate is a fraction, e.g. 0.15)
// Header totals are owned by the pod_recompute_quotation_totals trigger:
//   subtotal = SUM(net), grand = subtotal + tax + freight + insurance.
export function computeQuotationLine(input: {
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discountPct?: Prisma.Decimal | string | number | null
  discountAmount?: Prisma.Decimal | string | number | null
  taxRate?: Prisma.Decimal | string | number | null
}) {
  const quantity = new Prisma.Decimal(input.quantity)
  const unitPrice = new Prisma.Decimal(input.unitPrice)
  const gross = quantity.times(unitPrice)

  const discountAmount =
    input.discountAmount !== null && input.discountAmount !== undefined
      ? new Prisma.Decimal(input.discountAmount)
      : gross.times(new Prisma.Decimal(input.discountPct ?? 0))

  if (discountAmount.greaterThan(gross)) {
    throw new ConflictError('Line discount cannot exceed the line amount.')
  }

  const netAmount = gross.minus(discountAmount)
  const taxAmount = netAmount.times(new Prisma.Decimal(input.taxRate ?? 0))

  return { gross, discountAmount, netAmount, taxAmount }
}

async function resolveTaxRates(
  tenantId: string,
  taxRateIds: Array<string>,
  client: PrismaClientLike,
): Promise<Map<string, Prisma.Decimal>> {
  if (taxRateIds.length === 0) {
    return new Map()
  }

  const rows = await client.taxRate.findMany({
    where: { tenantId, id: { in: taxRateIds }, deletedAt: null },
    select: { id: true, rate: true },
  })

  return new Map(rows.map((row) => [row.id, row.rate]))
}

export async function recordQuotation(
  context: CurrentUserContext,
  tenantId: string,
  input: RecordQuotationInput,
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A quotation requires at least one line.')
  }

  const supplier = await supplierRepo.findSupplierById(
    tenantId,
    input.supplierId,
  )

  if (!supplier) {
    throw new NotFoundError('Supplier not found.')
  }

  const quotation = await prisma.$transaction(async (tx) => {
    if (input.rfqId) {
      const rfq = await rfqRepo.findRfqById(tenantId, input.rfqId, tx)

      if (!rfq) {
        throw new NotFoundError('RFQ not found.')
      }

      if (rfq.statusCode !== 'open') {
        throw new ConflictError(
          'Quotations can only be recorded for open RFQs.',
        )
      }

      if (
        !rfq.suppliers.some((entry) => entry.supplierId === input.supplierId)
      ) {
        throw new ConflictError('This supplier was not invited to the RFQ.')
      }
    }

    const taxRates = await resolveTaxRates(
      tenantId,
      input.lines
        .map((line) => line.taxRateId)
        .filter((id): id is string => Boolean(id)),
      tx,
    )

    const items = input.lines.map((line) => {
      const taxRate = line.taxRateId ? taxRates.get(line.taxRateId) : undefined

      if (line.taxRateId && taxRate === undefined) {
        throw new NotFoundError('Tax rate not found.')
      }

      const computed = computeQuotationLine({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPct: line.discountPct,
        discountAmount: line.discountAmount,
        taxRate,
      })

      return {
        productId: line.productId,
        variantId: line.variantId ?? null,
        uomId: line.uomId,
        quantity: new Prisma.Decimal(line.quantity),
        unitPrice: new Prisma.Decimal(line.unitPrice),
        discountPct:
          line.discountPct === null || line.discountPct === undefined
            ? null
            : new Prisma.Decimal(line.discountPct),
        discountAmount: computed.discountAmount,
        taxRateId: line.taxRateId ?? null,
        taxAmount: computed.taxAmount,
        netAmount: computed.netAmount,
        leadTimeDays: line.leadTimeDays ?? null,
        notes: line.notes ?? null,
      }
    })

    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'SUPPLIER_QUOTATION',
    })

    const created = await quotationRepo.createQuotation(
      tenantId,
      {
        documentNumber,
        rfqId: input.rfqId ?? null,
        supplierId: input.supplierId,
        quotationDate: input.quotationDate ?? undefined,
        validUntil: input.validUntil ?? null,
        currencyCode: input.currencyCode ?? 'USD',
        exchangeRate: input.exchangeRate ?? 1,
        leadTimeDays: input.leadTimeDays ?? null,
        paymentTerms: input.paymentTerms ?? null,
        freightAmount: input.freightAmount ?? 0,
        insuranceAmount: input.insuranceAmount ?? 0,
        remarks: input.remarks ?? null,
        createdBy: context.profileId,
        items,
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.quotation_record',
        entityType: 'pod_supplier_quotation',
        entityId: created.id,
        newValues: { documentNumber, supplierId: input.supplierId },
      },
      tx,
    )

    // Header totals are written by the item trigger — refetch inside the tx so
    // callers see the final numbers.
    return (await quotationRepo.findQuotationById(tenantId, created.id, tx))!
  })

  return serializeQuotation(quotation)
}

async function transitionQuotation(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  toCode: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled',
  actionKey: string,
) {
  const quotation = await prisma.$transaction(async (tx) => {
    const existing = await quotationRepo.findQuotationById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Quotation not found.')
    }

    await assertPodTransition(
      tenantId,
      'supplier_quotation',
      existing.statusCode,
      toCode,
      tx,
    )

    await quotationRepo.updateQuotationStatus(
      tenantId,
      id,
      toCode,
      toCode === 'approved'
        ? {
            approvedByProfileId: context.profileId,
            updatedBy: context.profileId,
          }
        : { updatedBy: context.profileId },
      tx,
    )

    if (toCode === 'submitted') {
      if (existing.rfqId) {
        await rfqRepo.updateRfqSupplierStatus(
          tenantId,
          existing.rfqId,
          existing.supplierId,
          'responded',
          { respondedAt: new Date() },
          tx,
        )
      }

      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'supplier_quotation.submitted',
        aggregateType: 'pod_supplier_quotation',
        aggregateId: existing.id,
        actorProfileId: context.profileId,
        payload: {
          documentNumber: existing.documentNumber,
          supplierId: existing.supplierId,
          grandTotal: existing.grandTotal.toString(),
        },
      })
    }

    if (toCode === 'approved') {
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'supplier_quotation.approved',
        aggregateType: 'pod_supplier_quotation',
        aggregateId: existing.id,
        actorProfileId: context.profileId,
        payload: {
          documentNumber: existing.documentNumber,
          supplierId: existing.supplierId,
          grandTotal: existing.grandTotal.toString(),
        },
      })
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey,
        entityType: 'pod_supplier_quotation',
        entityId: id,
        newValues: { statusCode: toCode },
      },
      tx,
    )

    return (await quotationRepo.findQuotationById(tenantId, id, tx))!
  })

  return serializeQuotation(quotation)
}

export function submitQuotation(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionQuotation(
    context,
    tenantId,
    id,
    'submitted',
    'purchase.quotation_submit',
  )
}

export function reviewQuotation(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionQuotation(
    context,
    tenantId,
    id,
    'under_review',
    'purchase.quotation_review',
  )
}

export function approveQuotation(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionQuotation(
    context,
    tenantId,
    id,
    'approved',
    'purchase.quotation_approve',
  )
}

export function rejectQuotation(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionQuotation(
    context,
    tenantId,
    id,
    'rejected',
    'purchase.quotation_reject',
  )
}

export async function listQuotations(
  _context: CurrentUserContext,
  tenantId: string,
  options: { statusCode?: string; supplierId?: string; rfqId?: string } = {},
) {
  const quotations = await quotationRepo.listQuotations(tenantId, options)

  return quotations.map(serializeQuotation)
}

export async function getQuotation(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const quotation = await quotationRepo.findQuotationById(tenantId, id)

  if (!quotation) {
    throw new NotFoundError('Quotation not found.')
  }

  return serializeQuotation(quotation)
}
