import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializePosSale } from '#/server/inventory/sales-dto'
import { postMovement } from '#/server/inventory/movement-engine'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PaymentMethod, PosOrderType } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as saleRepo from '#/server/repos/pos-sale-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface PosSaleLineDraft {
  productId: string
  variantId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discount?: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number
  itemNameSnapshot?: string | null
  skuSnapshot?: string | null
}

export interface CreatePosSaleInput {
  posSessionId?: string | null
  customerId?: string | null
  warehouseId: string
  locationId: string
  cashierProfileId?: string | null
  orderType?: PosOrderType
  currencyCode?: string
  notes?: string | null
  lines: Array<PosSaleLineDraft>
}

export interface PosPaymentDraft {
  method: PaymentMethod
  amount: Prisma.Decimal | string | number
  reference?: string | null
  cardLast4?: string | null
}

const ZERO = new Prisma.Decimal(0)

// A POS basket: computes line/header totals and persists as an OPEN sale.
export async function createPosSale(
  context: CurrentUserContext,
  tenantId: string,
  input: CreatePosSaleInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A sale requires at least one line.')
  }

  let subtotal = ZERO
  let discountTotal = ZERO
  let taxTotal = ZERO

  const lines = input.lines.map((line) => {
    const qty = new Prisma.Decimal(line.quantity)
    const price = new Prisma.Decimal(line.unitPrice)
    const discount = new Prisma.Decimal(line.discount ?? 0)
    const tax = new Prisma.Decimal(line.taxAmount ?? 0)
    const gross = qty.times(price)
    const lineTotal = gross.minus(discount).plus(tax)

    subtotal = subtotal.plus(gross)
    discountTotal = discountTotal.plus(discount)
    taxTotal = taxTotal.plus(tax)

    return {
      productId: line.productId,
      variantId: line.variantId ?? null,
      uomId: line.uomId,
      quantity: qty,
      unitPrice: price,
      discount,
      taxAmount: tax,
      lineTotal,
      itemNameSnapshot: line.itemNameSnapshot ?? null,
      skuSnapshot: line.skuSnapshot ?? null,
    }
  })

  const grandTotal = subtotal.minus(discountTotal).plus(taxTotal)

  const sale = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'POS_SALE',
    })

    const created = await saleRepo.createSale(
      tenantId,
      {
        documentNumber,
        posSessionId: input.posSessionId ?? null,
        customerId: input.customerId ?? null,
        warehouseId: input.warehouseId,
        locationId: input.locationId,
        cashierProfileId: input.cashierProfileId ?? context.profileId,
        orderType: input.orderType,
        currencyCode: input.currencyCode,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        notes: input.notes ?? null,
        createdByProfileId: context.profileId,
        lines,
      },
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'pos.sale_create',
        entityType: 'pos_sale',
        entityId: created.id,
        newValues: { documentNumber, grandTotal: grandTotal.toString() },
      },
      tx
    )

    return created
  })

  return serializePosSale(sale)
}

// Completing a POS sale immediately reduces stock: a SALE (OUT) movement per line
// issued at current WAC, the cost stamped back onto the line for margin, payments
// captured, and change computed — all atomically.
export async function completePosSale(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  payments: Array<PosPaymentDraft>
) {
  const completed = await prisma.$transaction(
    async (tx) => {
      const sale = await saleRepo.findSaleById(tenantId, id, tx)

      if (!sale) {
        throw new NotFoundError('Sale not found.')
      }

      assertTransition('posSale', sale.status.toLowerCase(), 'completed')

      for (const line of sale.lines) {
        const qty = new Prisma.Decimal(line.quantity)

        if (qty.lte(ZERO)) {
          continue
        }

        const result = await postMovement(tx, {
          tenantId,
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: sale.warehouseId,
          locationId: sale.locationId,
          movementType: 'SALE',
          direction: 'OUT',
          quantity: qty,
          uomId: line.uomId,
          sourceDocType: 'POS_SALE',
          sourceDocId: sale.id,
          sourceDocLineId: line.id,
          sourceDocNumber: sale.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: sale.correlationId ?? undefined,
        })

        await saleRepo.setLineCostAtSale(line.id, result.movementUnitCost, tx)
      }

      let amountPaid = ZERO

      for (const payment of payments) {
        const amount = new Prisma.Decimal(payment.amount)
        amountPaid = amountPaid.plus(amount)
        await saleRepo.addPayment(tenantId, sale.id, { ...payment, amount }, tx)
      }

      const grandTotal = new Prisma.Decimal(sale.grandTotal)
      const changeDue = amountPaid.gt(grandTotal) ? amountPaid.minus(grandTotal) : ZERO

      await saleRepo.completeSale(tenantId, id, { amountPaid, changeDue }, tx)

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'pos.sale_complete',
          entityType: 'pos_sale',
          entityId: sale.id,
          newValues: { documentNumber: sale.documentNumber, amountPaid: amountPaid.toString() },
        },
        tx
      )

      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'pos_sale.completed',
        aggregateType: 'pos_sale',
        aggregateId: sale.id,
        customerId: sale.customerId,
        payload: {
          documentNumber: sale.documentNumber,
          warehouseId: sale.warehouseId,
          orderType: sale.orderType,
          currencyCode: sale.currencyCode,
          subtotal: sale.subtotal.toString(),
          discountTotal: sale.discountTotal.toString(),
          taxTotal: sale.taxTotal.toString(),
          grandTotal: sale.grandTotal.toString(),
          amountPaid: amountPaid.toString(),
          paymentMethods: payments.map((payment) => payment.method),
          lines: sale.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
            lineTotal: line.lineTotal.toString(),
          })),
        },
        correlationId: sale.correlationId,
        actorProfileId: context.profileId,
      })

      const refreshed = await saleRepo.findSaleById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializePosSale(completed)
}

export async function voidPosSale(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const sale = await saleRepo.findSaleById(tenantId, id)

  if (!sale) {
    throw new NotFoundError('Sale not found.')
  }

  assertTransition('posSale', sale.status.toLowerCase(), 'voided')

  await prisma.$transaction(async (tx) => {
    await saleRepo.updateSaleStatus(tenantId, id, 'VOIDED', tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'pos.sale_void',
        entityType: 'pos_sale',
        entityId: id,
      },
      tx
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'pos_sale.voided',
      aggregateType: 'pos_sale',
      aggregateId: sale.id,
      customerId: sale.customerId,
      payload: { documentNumber: sale.documentNumber },
      correlationId: sale.correlationId,
      actorProfileId: context.profileId,
    })
  })

  const refreshed = await saleRepo.findSaleById(tenantId, id)

  return serializePosSale(refreshed!)
}

export async function listPosSales(_context: CurrentUserContext, tenantId: string) {
  const sales = await saleRepo.listSales(tenantId, {})

  return sales.map((sale) => ({
    ...sale,
    subtotal: sale.subtotal.toString(),
    discountTotal: sale.discountTotal.toString(),
    taxTotal: sale.taxTotal.toString(),
    grandTotal: sale.grandTotal.toString(),
    amountPaid: sale.amountPaid.toString(),
    changeDue: sale.changeDue.toString(),
  }))
}

export async function getPosSale(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const sale = await saleRepo.findSaleById(tenantId, id)

  if (!sale) {
    throw new NotFoundError('Sale not found.')
  }

  return serializePosSale(sale)
}
