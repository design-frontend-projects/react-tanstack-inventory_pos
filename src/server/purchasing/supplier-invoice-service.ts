import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as invoiceRepo from '#/server/repos/pod-supplier-invoice-repo'
import * as matchRepo from '#/server/repos/pod-supplier-invoice-match-repo'
import * as poRepo from '#/server/repos/purchase-order-repo'
import * as supplierRepo from '#/server/repos/supplier-repo'
import { openApprovalRequest } from '#/server/purchasing/approval-engine'
import { assertPodTransition } from '#/server/purchasing/pod-status-service'
import { computeQuotationLine } from '#/server/purchasing/quotation-service'
import { serializeSupplierInvoice } from '#/server/purchasing/ap-dto'
import {
  computeLineMatch,
  deriveMatchStatus,
} from '#/server/purchasing/three-way-match'
import type { CurrentUserContext } from '#/types/auth'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierInvoiceItemDraft {
  productId?: string | null
  variantId?: string | null
  description?: string | null
  purchaseOrderLineId?: string | null
  goodsReceiptLineId?: string | null
  uomId?: string | null
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discountAmount?: Prisma.Decimal | string | number | null
  taxRateId?: string | null
}

export interface CreateSupplierInvoiceInput {
  supplierId: string
  purchaseOrderId?: string | null
  supplierInvoiceNumber?: string | null
  invoiceDate?: Date | null
  dueDate?: Date | null
  currencyCode?: string
  exchangeRate?: string | number | null
  freightAmount?: string | number | null
  retentionAmount?: string | number | null
  withholdingTaxAmount?: string | number | null
  notes?: string | null
  items: Array<SupplierInvoiceItemDraft>
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

// Accepted qty per PO line across POSTED goods receipts — the "received" leg
// of the 3-way match.
async function sumAcceptedQtyByPoLine(
  tenantId: string,
  purchaseOrderLineIds: Array<string>,
  client: PrismaClientLike,
): Promise<Map<string, Prisma.Decimal>> {
  if (purchaseOrderLineIds.length === 0) {
    return new Map()
  }

  const rows = await client.goodsReceiptLine.groupBy({
    by: ['purchaseOrderLineId'],
    where: {
      tenantId,
      purchaseOrderLineId: { in: purchaseOrderLineIds },
      goodsReceipt: { isPosted: true },
    },
    _sum: { acceptedQty: true },
  })

  return new Map(
    rows
      .filter((row) => row.purchaseOrderLineId !== null)
      .map((row) => [
        row.purchaseOrderLineId as string,
        row._sum.acceptedQty ?? new Prisma.Decimal(0),
      ]),
  )
}

function buildInvoiceItems(
  input: Array<SupplierInvoiceItemDraft>,
  taxRates: Map<string, Prisma.Decimal>,
): Array<invoiceRepo.SupplierInvoiceItemInput> {
  return input.map((item) => {
    const taxRate = item.taxRateId ? taxRates.get(item.taxRateId) : undefined

    if (item.taxRateId && taxRate === undefined) {
      throw new NotFoundError('Tax rate not found.')
    }

    // Same line math as quotations: net = qty * price - discount, tax on net.
    const computed = computeQuotationLine({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount ?? 0,
      taxRate,
    })

    return {
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      description: item.description ?? null,
      purchaseOrderLineId: item.purchaseOrderLineId ?? null,
      goodsReceiptLineId: item.goodsReceiptLineId ?? null,
      uomId: item.uomId ?? null,
      quantity: new Prisma.Decimal(item.quantity),
      unitPrice: new Prisma.Decimal(item.unitPrice),
      discountAmount: computed.discountAmount,
      taxRateId: item.taxRateId ?? null,
      taxAmount: computed.taxAmount,
      netAmount: computed.netAmount,
    }
  })
}

export async function createSupplierInvoice(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateSupplierInvoiceInput,
) {
  if (input.items.length === 0) {
    throw new ConflictError('A supplier invoice requires at least one item.')
  }

  const supplier = await supplierRepo.findSupplierById(
    tenantId,
    input.supplierId,
  )

  if (!supplier) {
    throw new NotFoundError('Supplier not found.')
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (input.purchaseOrderId) {
      const po = await poRepo.findPurchaseOrderById(
        tenantId,
        input.purchaseOrderId,
        tx,
      )

      if (!po) {
        throw new NotFoundError('Purchase order not found.')
      }

      if (po.supplierId !== input.supplierId) {
        throw new ConflictError(
          'The purchase order belongs to a different supplier.',
        )
      }
    }

    const taxRates = await resolveTaxRates(
      tenantId,
      input.items
        .map((item) => item.taxRateId)
        .filter((id): id is string => Boolean(id)),
      tx,
    )

    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'SUPPLIER_INVOICE',
    })

    const created = await invoiceRepo.createInvoice(
      tenantId,
      {
        documentNumber,
        supplierInvoiceNumber: input.supplierInvoiceNumber ?? null,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId ?? null,
        invoiceDate: input.invoiceDate ?? null,
        dueDate: input.dueDate ?? null,
        currencyCode: input.currencyCode ?? 'USD',
        exchangeRate: input.exchangeRate ?? 1,
        freightAmount: input.freightAmount ?? 0,
        retentionAmount: input.retentionAmount ?? 0,
        withholdingTaxAmount: input.withholdingTaxAmount ?? 0,
        notes: input.notes ?? null,
        createdBy: context.profileId,
        items: buildInvoiceItems(input.items, taxRates),
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.invoice_create',
        entityType: 'pod_supplier_invoice',
        entityId: created.id,
        newValues: { documentNumber, supplierId: input.supplierId },
      },
      tx,
    )

    // Header totals are written by the item trigger — refetch inside the tx.
    return (await invoiceRepo.findInvoiceById(tenantId, created.id, tx))!
  })

  return serializeSupplierInvoice(invoice)
}

// The standard AP flow: bill exactly what has been received (accepted on
// posted GRNs) and not yet invoiced, at PO cost. Fails when nothing is left.
export async function createSupplierInvoiceFromPo(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    purchaseOrderId: string
    supplierInvoiceNumber?: string | null
    invoiceDate?: Date | null
    dueDate?: Date | null
    notes?: string | null
  },
) {
  const po = await poRepo.findPurchaseOrderById(tenantId, input.purchaseOrderId)

  if (!po) {
    throw new NotFoundError('Purchase order not found.')
  }

  const lineIds = po.lines.map((line) => line.id)
  const [accepted, invoiced] = await Promise.all([
    sumAcceptedQtyByPoLine(tenantId, lineIds, prisma),
    invoiceRepo.sumInvoicedQtyByPoLine(tenantId, lineIds),
  ])

  const zero = new Prisma.Decimal(0)
  const items: Array<SupplierInvoiceItemDraft> = []

  for (const line of po.lines) {
    const invoiceable = (accepted.get(line.id) ?? zero).minus(
      invoiced.get(line.id) ?? zero,
    )

    if (invoiceable.greaterThan(zero)) {
      items.push({
        productId: line.productId,
        variantId: line.variantId,
        purchaseOrderLineId: line.id,
        uomId: line.uomId,
        quantity: invoiceable,
        unitPrice: line.unitCost,
        taxRateId: line.taxRateId,
      })
    }
  }

  if (items.length === 0) {
    throw new ConflictError(
      'Nothing left to invoice — no accepted receipts remain unbilled on this purchase order.',
    )
  }

  return createSupplierInvoice(context, tenantId, {
    supplierId: po.supplierId,
    purchaseOrderId: po.id,
    supplierInvoiceNumber: input.supplierInvoiceNumber ?? null,
    invoiceDate: input.invoiceDate ?? null,
    dueDate: input.dueDate ?? null,
    currencyCode: po.currencyCode,
    notes: input.notes ?? `From purchase order ${po.documentNumber}`,
    items,
  })
}

// 3-way match: every invoice item with a PO reference is matched against the
// PO line cost and the accepted receipt quantity. Match rows are replaced,
// the header match status recomputed, and the outcome event-sourced.
export async function matchSupplierInvoice(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const invoice = await prisma.$transaction(async (tx) => {
    const existing = await invoiceRepo.findInvoiceById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier invoice not found.')
    }

    if (existing.statusCode === 'cancelled' || existing.isPosted) {
      throw new ConflictError(
        'Only unposted, non-cancelled invoices can be matched.',
      )
    }

    const poLineIds = existing.items
      .map((item) => item.purchaseOrderLineId)
      .filter((lineId): lineId is string => Boolean(lineId))

    const [poLines, accepted, previouslyInvoiced] = await Promise.all([
      tx.purchaseOrderLine.findMany({
        where: { tenantId, id: { in: poLineIds } },
        select: { id: true, unitCost: true },
      }),
      sumAcceptedQtyByPoLine(tenantId, poLineIds, tx),
      invoiceRepo.sumInvoicedQtyByPoLine(tenantId, poLineIds, id, tx),
    ])

    const costByLine = new Map(poLines.map((line) => [line.id, line.unitCost]))
    const zero = new Prisma.Decimal(0)

    const matches = existing.items.map((item) =>
      computeLineMatch({
        invoiceItemId: item.id,
        purchaseOrderLineId: item.purchaseOrderLineId,
        goodsReceiptLineId: item.goodsReceiptLineId,
        invoicedQty: item.quantity,
        lineAmount: item.netAmount.plus(item.taxAmount),
        invoiceUnitPrice: item.unitPrice,
        poUnitCost: item.purchaseOrderLineId
          ? (costByLine.get(item.purchaseOrderLineId) ?? null)
          : null,
        receivedQty: item.purchaseOrderLineId
          ? (accepted.get(item.purchaseOrderLineId) ?? zero)
          : zero,
        previouslyInvoicedQty: item.purchaseOrderLineId
          ? (previouslyInvoiced.get(item.purchaseOrderLineId) ?? zero)
          : zero,
      }),
    )

    const matchStatusCode = deriveMatchStatus(matches, existing.grandTotal)

    await matchRepo.replaceMatches(tenantId, id, matches, tx)
    await invoiceRepo.updateInvoiceMatchStatus(
      tenantId,
      id,
      matchStatusCode,
      context.profileId,
      tx,
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'supplier_invoice.matched',
      aggregateType: 'pod_supplier_invoice',
      aggregateId: id,
      actorProfileId: context.profileId,
      payload: {
        documentNumber: existing.documentNumber,
        matchStatusCode,
      },
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.invoice_match',
        entityType: 'pod_supplier_invoice',
        entityId: id,
        newValues: { matchStatusCode, matchRows: matches.length },
      },
      tx,
    )

    return (await invoiceRepo.findInvoiceById(tenantId, id, tx))!
  })

  return serializeSupplierInvoice(invoice)
}

// Routes a draft invoice through the generic approval engine. The lookup
// lifecycle has no draft -> approved edge, so an auto-approval still walks
// draft -> pending_approval -> approved (both edges are seeded).
export async function submitSupplierInvoiceForApproval(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const invoice = await prisma.$transaction(async (tx) => {
    const existing = await invoiceRepo.findInvoiceById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier invoice not found.')
    }

    await assertPodTransition(
      tenantId,
      'supplier_invoice',
      existing.statusCode,
      'pending_approval',
      tx,
    )

    const decision = await openApprovalRequest(context, tenantId, tx, {
      entityType: 'supplier_invoice',
      entityId: id,
      amount: existing.grandTotal.toString(),
      currencyCode: existing.currencyCode,
    })

    if (decision.statusCode === 'approved') {
      await assertPodTransition(
        tenantId,
        'supplier_invoice',
        'pending_approval',
        'approved',
        tx,
      )
    }

    await invoiceRepo.updateInvoiceStatus(
      tenantId,
      id,
      decision.statusCode === 'approved' ? 'approved' : 'pending_approval',
      {
        approvalRequestId: decision.requestId,
        updatedBy: context.profileId,
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.invoice_submit',
        entityType: 'pod_supplier_invoice',
        entityId: id,
        newValues: {
          approvalStatus: decision.statusCode,
          approvalRequestId: decision.requestId,
        },
      },
      tx,
    )

    return (await invoiceRepo.findInvoiceById(tenantId, id, tx))!
  })

  return serializeSupplierInvoice(invoice)
}

// Posting enters the invoice into the AP subledger: it becomes payable,
// the supplier's running balance is recomputed (DB function), and the
// `supplier_invoice.posted` event is emitted for the future GL subscriber.
// A variance match blocks posting unless explicitly overridden.
export async function postSupplierInvoice(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  options: { overrideVariance?: boolean } = {},
) {
  const invoice = await prisma.$transaction(async (tx) => {
    const existing = await invoiceRepo.findInvoiceById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier invoice not found.')
    }

    if (
      existing.matchStatusCode === 'variance' &&
      options.overrideVariance !== true
    ) {
      throw new ConflictError(
        'This invoice has a 3-way-match price variance. Resolve it or post with an explicit variance override.',
      )
    }

    await assertPodTransition(
      tenantId,
      'supplier_invoice',
      existing.statusCode,
      'posted',
      tx,
    )

    await invoiceRepo.markInvoicePosted(tenantId, id, context.profileId, tx)

    // Supplier running balance = posted outstanding - unallocated advances.
    await tx.$queryRaw`SELECT pod_recompute_supplier_balance(${tenantId}::uuid, ${existing.supplierId}::uuid)`

    const outstanding = existing.grandTotal.minus(existing.paidAmount)

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'supplier_invoice.posted',
      aggregateType: 'pod_supplier_invoice',
      aggregateId: id,
      actorProfileId: context.profileId,
      payload: {
        documentNumber: existing.documentNumber,
        supplierId: existing.supplierId,
        grandTotal: existing.grandTotal.toString(),
        outstandingAmount: outstanding.toString(),
      },
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.invoice_post',
        entityType: 'pod_supplier_invoice',
        entityId: id,
        newValues: {
          grandTotal: existing.grandTotal.toString(),
          overrideVariance: options.overrideVariance === true,
        },
      },
      tx,
    )

    return (await invoiceRepo.findInvoiceById(tenantId, id, tx))!
  })

  return serializeSupplierInvoice(invoice)
}

async function transitionInvoice(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  toCode: 'disputed' | 'approved' | 'cancelled',
  actionKey: string,
) {
  const invoice = await prisma.$transaction(async (tx) => {
    const existing = await invoiceRepo.findInvoiceById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier invoice not found.')
    }

    await assertPodTransition(
      tenantId,
      'supplier_invoice',
      existing.statusCode,
      toCode,
      tx,
    )

    await invoiceRepo.updateInvoiceStatus(
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
        entityType: 'pod_supplier_invoice',
        entityId: id,
        newValues: { statusCode: toCode },
      },
      tx,
    )

    return (await invoiceRepo.findInvoiceById(tenantId, id, tx))!
  })

  return serializeSupplierInvoice(invoice)
}

export function disputeSupplierInvoice(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionInvoice(
    context,
    tenantId,
    id,
    'disputed',
    'purchase.invoice_dispute',
  )
}

export function resolveSupplierInvoiceDispute(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionInvoice(
    context,
    tenantId,
    id,
    'approved',
    'purchase.invoice_resolve',
  )
}

export function cancelSupplierInvoice(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  return transitionInvoice(
    context,
    tenantId,
    id,
    'cancelled',
    'purchase.invoice_cancel',
  )
}

export async function listSupplierInvoices(
  _context: CurrentUserContext,
  tenantId: string,
  options: {
    statusCode?: string
    matchStatusCode?: string
    paymentStatusCode?: string
    supplierId?: string
    purchaseOrderId?: string
  } = {},
) {
  const invoices = await invoiceRepo.listInvoices(tenantId, options)

  return invoices.map(serializeSupplierInvoice)
}

export async function getSupplierInvoice(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const invoice = await invoiceRepo.findInvoiceById(tenantId, id)

  if (!invoice) {
    throw new NotFoundError('Supplier invoice not found.')
  }

  return serializeSupplierInvoice(invoice)
}
