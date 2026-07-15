import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeSalesInvoice } from '#/server/inventory/sales-dto'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as invoiceRepo from '#/server/repos/sales-invoice-repo'
import * as salesOrderRepo from '#/server/repos/sales-order-repo'
import type { CurrentUserContext } from '#/types/auth'

const ZERO = new Prisma.Decimal(0)

// Builds a draft invoice from a fulfilled sales order (invoicing the fulfilled
// quantities) and marks the order INVOICED.
export async function createInvoiceFromOrder(
  context: CurrentUserContext,
  tenantId: string,
  salesOrderId: string
) {
  const invoice = await prisma.$transaction(async (tx) => {
    const order = await salesOrderRepo.findSalesOrderById(tenantId, salesOrderId, tx)

    if (!order) {
      throw new NotFoundError('Sales order not found.')
    }

    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'SALES_INVOICE',
    })

    const lines = order.lines.map((line) => {
      const qty = new Prisma.Decimal(line.fulfilledQty).gt(ZERO)
        ? new Prisma.Decimal(line.fulfilledQty)
        : new Prisma.Decimal(line.orderedQty)

      return {
        productId: line.productId,
        variantId: line.variantId,
        uomId: line.uomId,
        quantity: qty,
        unitPrice: new Prisma.Decimal(line.unitPrice),
        discount: new Prisma.Decimal(line.discount),
        taxAmount: new Prisma.Decimal(line.taxAmount),
        lineTotal: new Prisma.Decimal(line.lineTotal),
      }
    })

    const created = await invoiceRepo.createInvoice(
      tenantId,
      {
        documentNumber,
        salesOrderId: order.id,
        customerId: order.customerId,
        currencyCode: order.currencyCode,
        subtotal: new Prisma.Decimal(order.subtotal),
        discountTotal: new Prisma.Decimal(order.discountTotal),
        taxTotal: new Prisma.Decimal(order.taxTotal),
        grandTotal: new Prisma.Decimal(order.grandTotal),
        createdByProfileId: context.profileId,
        lines,
      },
      tx
    )

    if (order.status.toLowerCase() === 'fulfilled') {
      await salesOrderRepo.updateSalesOrderStatus(tenantId, order.id, 'INVOICED', tx)
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'sales.invoice_create',
        entityType: 'sales_invoice',
        entityId: created.id,
        newValues: { documentNumber, salesOrderId: order.id },
      },
      tx
    )

    return created
  })

  return serializeSalesInvoice(invoice)
}

export async function issueInvoice(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const invoice = await invoiceRepo.findInvoiceById(tenantId, id)

  if (!invoice) {
    throw new NotFoundError('Invoice not found.')
  }

  assertTransition('salesInvoice', invoice.status.toLowerCase(), 'issued')
  await invoiceRepo.updateInvoiceStatus(tenantId, id, 'ISSUED')

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'sales.invoice_issue',
    entityType: 'sales_invoice',
    entityId: id,
  })

  const refreshed = await invoiceRepo.findInvoiceById(tenantId, id)

  return serializeSalesInvoice(refreshed!)
}

// Records a payment against an issued invoice; advances to PARTIALLY_PAID or PAID.
export async function recordInvoicePayment(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  amount: Prisma.Decimal | string | number
) {
  const paid = await prisma.$transaction(async (tx) => {
    const invoice = await invoiceRepo.findInvoiceById(tenantId, id, tx)

    if (!invoice) {
      throw new NotFoundError('Invoice not found.')
    }

    const payment = new Prisma.Decimal(amount)

    if (payment.lte(ZERO)) {
      throw new ConflictError('Payment amount must be positive.')
    }

    const newAmountPaid = new Prisma.Decimal(invoice.amountPaid).plus(payment)
    const grandTotal = new Prisma.Decimal(invoice.grandTotal)
    const target = newAmountPaid.gte(grandTotal) ? 'paid' : 'partially_paid'

    assertTransition('salesInvoice', invoice.status.toLowerCase(), target)

    await invoiceRepo.applyInvoicePayment(
      tenantId,
      id,
      newAmountPaid,
      target === 'paid' ? 'PAID' : 'PARTIALLY_PAID',
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'sales.invoice_payment',
        entityType: 'sales_invoice',
        entityId: id,
        newValues: { amount: payment.toString(), amountPaid: newAmountPaid.toString() },
      },
      tx
    )

    const refreshed = await invoiceRepo.findInvoiceById(tenantId, id, tx)

    return refreshed!
  })

  return serializeSalesInvoice(paid)
}

export async function listInvoices(_context: CurrentUserContext, tenantId: string) {
  const invoices = await invoiceRepo.listInvoices(tenantId, {})

  return invoices.map((invoice) => ({
    ...invoice,
    subtotal: invoice.subtotal.toString(),
    discountTotal: invoice.discountTotal.toString(),
    taxTotal: invoice.taxTotal.toString(),
    grandTotal: invoice.grandTotal.toString(),
    amountPaid: invoice.amountPaid.toString(),
  }))
}

export async function getInvoice(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const invoice = await invoiceRepo.findInvoiceById(tenantId, id)

  if (!invoice) {
    throw new NotFoundError('Invoice not found.')
  }

  return serializeSalesInvoice(invoice)
}
