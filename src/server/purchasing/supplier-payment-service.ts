import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as invoiceRepo from '#/server/repos/pod-supplier-invoice-repo'
import * as paymentRepo from '#/server/repos/pod-supplier-payment-repo'
import * as supplierRepo from '#/server/repos/supplier-repo'
import { openApprovalRequest } from '#/server/purchasing/approval-engine'
import { serializeSupplierPayment } from '#/server/purchasing/payment-dto'
import { assertPodTransition } from '#/server/purchasing/pod-status-service'
import type { CurrentUserContext } from '#/types/auth'
import type { PrismaClientLike } from '#/server/db/types'

const ZERO = new Prisma.Decimal(0)
const TOLERANCE = new Prisma.Decimal('0.01')

// Pure: an invoice's payment status from its totals (tolerance-aware).
export function derivePaymentStatus(
  grandTotal: Prisma.Decimal | string | number,
  paidAmount: Prisma.Decimal | string | number,
  tolerance: Prisma.Decimal = TOLERANCE,
): 'unpaid' | 'partially_paid' | 'paid' {
  const grand = new Prisma.Decimal(grandTotal)
  const paid = new Prisma.Decimal(paidAmount)

  if (paid.lessThanOrEqualTo(ZERO)) {
    return 'unpaid'
  }

  if (paid.greaterThanOrEqualTo(grand.minus(tolerance))) {
    return 'paid'
  }

  return 'partially_paid'
}

// Pure: totals + over-allocation guard for a payment's allocation set.
export function summarizeAllocations(
  paymentAmount: Prisma.Decimal | string | number,
  rows: Array<{ allocatedAmount: Prisma.Decimal | string | number }>,
): { allocatedAmount: Prisma.Decimal; unallocatedAmount: Prisma.Decimal } {
  const amount = new Prisma.Decimal(paymentAmount)
  const allocated = rows.reduce(
    (sum, row) => sum.plus(new Prisma.Decimal(row.allocatedAmount)),
    ZERO,
  )

  if (rows.some((row) => new Prisma.Decimal(row.allocatedAmount).lte(ZERO))) {
    throw new ConflictError('Each allocation must be a positive amount.')
  }

  if (allocated.greaterThan(amount)) {
    throw new ConflictError(
      'Allocations exceed the payment amount (over-allocation).',
    )
  }

  return {
    allocatedAmount: allocated,
    unallocatedAmount: amount.minus(allocated),
  }
}

export interface CreateSupplierPaymentInput {
  supplierId: string
  paymentMethodId?: string | null
  paymentDate?: Date | null
  currencyCode?: string
  exchangeRate?: string | number | null
  amount: string | number
  referenceNumber?: string | null
  bankAccountId?: string | null
  isAdvance?: boolean
  notes?: string | null
}

export async function createSupplierPayment(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateSupplierPaymentInput,
) {
  if (new Prisma.Decimal(input.amount).lessThanOrEqualTo(ZERO)) {
    throw new ConflictError('A payment requires a positive amount.')
  }

  const supplier = await supplierRepo.findSupplierById(
    tenantId,
    input.supplierId,
  )

  if (!supplier) {
    throw new NotFoundError('Supplier not found.')
  }

  const payment = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'SUPPLIER_PAYMENT',
    })

    const created = await paymentRepo.createPayment(
      tenantId,
      {
        documentNumber,
        supplierId: input.supplierId,
        paymentMethodId: input.paymentMethodId ?? null,
        paymentDate: input.paymentDate ?? null,
        currencyCode: input.currencyCode ?? 'USD',
        exchangeRate: input.exchangeRate ?? 1,
        amount: input.amount,
        referenceNumber: input.referenceNumber ?? null,
        bankAccountId: input.bankAccountId ?? null,
        isAdvance: input.isAdvance ?? false,
        notes: input.notes ?? null,
        createdBy: context.profileId,
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.payment_create',
        entityType: 'pod_supplier_payment',
        entityId: created.id,
        newValues: {
          documentNumber,
          supplierId: input.supplierId,
          amount: String(input.amount),
        },
      },
      tx,
    )

    return created
  })

  return serializeSupplierPayment(payment)
}

// Open (still unposted) allocations by OTHER payments against the same
// invoices — posted payments are already netted into the invoice's paid
// amount, but drafts in flight must not double-claim the same outstanding.
async function sumPendingAllocationsByInvoice(
  tenantId: string,
  supplierInvoiceIds: Array<string>,
  excludePaymentId: string,
  client: PrismaClientLike,
): Promise<Map<string, Prisma.Decimal>> {
  if (supplierInvoiceIds.length === 0) {
    return new Map()
  }

  const rows = await client.podSupplierPaymentAllocation.groupBy({
    by: ['supplierInvoiceId'],
    where: {
      tenantId,
      supplierInvoiceId: { in: supplierInvoiceIds },
      paymentId: { not: excludePaymentId },
      payment: {
        isPosted: false,
        statusCode: { not: 'cancelled' },
        deletedAt: null,
      },
    },
    _sum: { allocatedAmount: true },
  })

  return new Map(
    rows
      .filter((row) => row.supplierInvoiceId !== null)
      .map((row) => [
        row.supplierInvoiceId as string,
        row._sum.allocatedAmount ?? ZERO,
      ]),
  )
}

// Replaces the payment's allocation set. Every row must target a POSTED
// invoice of the same supplier and fit inside that invoice's remaining
// outstanding (net of other in-flight payment drafts).
export async function allocateSupplierPayment(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: {
    allocations: Array<{ supplierInvoiceId: string; amount: string | number }>
  },
) {
  const payment = await prisma.$transaction(async (tx) => {
    const existing = await paymentRepo.findPaymentById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier payment not found.')
    }

    if (existing.isPosted || existing.statusCode === 'cancelled') {
      throw new ConflictError(
        'Only unposted, non-cancelled payments can be allocated.',
      )
    }

    const byInvoice = new Map<string, Prisma.Decimal>()
    for (const row of input.allocations) {
      const previous = byInvoice.get(row.supplierInvoiceId) ?? ZERO
      byInvoice.set(
        row.supplierInvoiceId,
        previous.plus(new Prisma.Decimal(row.amount)),
      )
    }

    const invoiceIds = Array.from(byInvoice.keys())
    const totals = summarizeAllocations(
      existing.amount,
      input.allocations.map((row) => ({ allocatedAmount: row.amount })),
    )

    const pending = await sumPendingAllocationsByInvoice(
      tenantId,
      invoiceIds,
      id,
      tx,
    )

    for (const invoiceId of invoiceIds) {
      const invoice = await invoiceRepo.findInvoiceById(tenantId, invoiceId, tx)

      if (!invoice) {
        throw new NotFoundError('Supplier invoice not found.')
      }

      if (!invoice.isPosted) {
        throw new ConflictError(
          `Invoice ${invoice.documentNumber} is not posted — only posted invoices can be paid.`,
        )
      }

      if (invoice.supplierId !== existing.supplierId) {
        throw new ConflictError(
          `Invoice ${invoice.documentNumber} belongs to a different supplier.`,
        )
      }

      const remaining = invoice.outstandingAmount.minus(
        pending.get(invoiceId) ?? ZERO,
      )
      const requested = byInvoice.get(invoiceId) ?? ZERO

      if (requested.greaterThan(remaining.plus(TOLERANCE))) {
        throw new ConflictError(
          `Allocation to ${invoice.documentNumber} exceeds its remaining outstanding (${remaining.toString()}).`,
        )
      }
    }

    await paymentRepo.replaceAllocations(
      tenantId,
      id,
      input.allocations.map((row) => ({
        supplierInvoiceId: row.supplierInvoiceId,
        allocatedAmount: row.amount,
      })),
      totals,
      context.profileId,
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.payment_allocate',
        entityType: 'pod_supplier_payment',
        entityId: id,
        newValues: {
          rows: input.allocations.length,
          allocatedAmount: totals.allocatedAmount.toString(),
        },
      },
      tx,
    )

    return (await paymentRepo.findPaymentById(tenantId, id, tx))!
  })

  return serializeSupplierPayment(payment)
}

// Routes a draft payment through the generic approval engine — the lifecycle
// has no draft -> approved edge, so auto-approval walks
// draft -> pending_approval -> approved (both edges are seeded).
export async function submitSupplierPaymentForApproval(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const payment = await prisma.$transaction(async (tx) => {
    const existing = await paymentRepo.findPaymentById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier payment not found.')
    }

    await assertPodTransition(
      tenantId,
      'supplier_payment',
      existing.statusCode,
      'pending_approval',
      tx,
    )

    const decision = await openApprovalRequest(context, tenantId, tx, {
      entityType: 'supplier_payment',
      entityId: id,
      amount: existing.amount.toString(),
      currencyCode: existing.currencyCode,
    })

    if (decision.statusCode === 'approved') {
      await assertPodTransition(
        tenantId,
        'supplier_payment',
        'pending_approval',
        'approved',
        tx,
      )
    }

    await paymentRepo.updatePaymentStatus(
      tenantId,
      id,
      decision.statusCode === 'approved' ? 'approved' : 'pending_approval',
      context.profileId,
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.payment_submit',
        entityType: 'pod_supplier_payment',
        entityId: id,
        newValues: {
          approvalStatus: decision.statusCode,
          approvalRequestId: decision.requestId,
        },
      },
      tx,
    )

    return (await paymentRepo.findPaymentById(tenantId, id, tx))!
  })

  return serializeSupplierPayment(payment)
}

// Posting settles the payment into the AP subledger: each allocation is
// applied to its invoice (paid/outstanding/payment status), the supplier's
// running balance is recomputed, and `supplier_payment.posted` is emitted.
export async function postSupplierPayment(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const payment = await prisma.$transaction(async (tx) => {
    const existing = await paymentRepo.findPaymentById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier payment not found.')
    }

    await assertPodTransition(
      tenantId,
      'supplier_payment',
      existing.statusCode,
      'posted',
      tx,
    )

    for (const allocation of existing.allocations) {
      if (!allocation.supplierInvoiceId) {
        continue
      }

      const invoice = await invoiceRepo.findInvoiceById(
        tenantId,
        allocation.supplierInvoiceId,
        tx,
      )

      if (!invoice || !invoice.isPosted) {
        throw new ConflictError(
          'An allocated invoice is missing or unposted — re-allocate the payment.',
        )
      }

      const newPaid = invoice.paidAmount.plus(allocation.allocatedAmount)

      if (newPaid.greaterThan(invoice.grandTotal.plus(TOLERANCE))) {
        throw new ConflictError(
          `Posting would overpay invoice ${invoice.documentNumber}.`,
        )
      }

      await tx.podSupplierInvoice.updateMany({
        where: { id: invoice.id, tenantId, deletedAt: null },
        data: {
          paidAmount: newPaid,
          outstandingAmount: invoice.grandTotal.minus(newPaid),
          paymentStatusCode: derivePaymentStatus(invoice.grandTotal, newPaid),
          updatedBy: context.profileId,
        },
      })
    }

    await paymentRepo.markPaymentPosted(tenantId, id, context.profileId, tx)

    // Supplier running balance = posted outstanding - unallocated advances.
    await tx.$queryRaw`SELECT pod_recompute_supplier_balance(${tenantId}::uuid, ${existing.supplierId}::uuid)`

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'supplier_payment.posted',
      aggregateType: 'pod_supplier_payment',
      aggregateId: id,
      actorProfileId: context.profileId,
      payload: {
        documentNumber: existing.documentNumber,
        supplierId: existing.supplierId,
        amount: existing.amount.toString(),
        allocatedAmount: existing.allocatedAmount.toString(),
      },
    })

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.payment_post',
        entityType: 'pod_supplier_payment',
        entityId: id,
        newValues: { amount: existing.amount.toString() },
      },
      tx,
    )

    return (await paymentRepo.findPaymentById(tenantId, id, tx))!
  })

  return serializeSupplierPayment(payment)
}

export async function cancelSupplierPayment(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const payment = await prisma.$transaction(async (tx) => {
    const existing = await paymentRepo.findPaymentById(tenantId, id, tx)

    if (!existing) {
      throw new NotFoundError('Supplier payment not found.')
    }

    await assertPodTransition(
      tenantId,
      'supplier_payment',
      existing.statusCode,
      'cancelled',
      tx,
    )

    await paymentRepo.updatePaymentStatus(
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
        actionKey: 'purchase.payment_cancel',
        entityType: 'pod_supplier_payment',
        entityId: id,
        newValues: { statusCode: 'cancelled' },
      },
      tx,
    )

    return (await paymentRepo.findPaymentById(tenantId, id, tx))!
  })

  return serializeSupplierPayment(payment)
}

export async function listSupplierPayments(
  _context: CurrentUserContext,
  tenantId: string,
  options: {
    statusCode?: string
    supplierId?: string
    isAdvance?: boolean
  } = {},
) {
  const payments = await paymentRepo.listPayments(tenantId, options)

  return payments.map(serializeSupplierPayment)
}

export async function getSupplierPayment(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const payment = await paymentRepo.findPaymentById(tenantId, id)

  if (!payment) {
    throw new NotFoundError('Supplier payment not found.')
  }

  return serializeSupplierPayment(payment)
}
