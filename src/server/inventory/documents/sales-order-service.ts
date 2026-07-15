import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeSalesOrder } from '#/server/inventory/sales-dto'
import { postMovement } from '#/server/inventory/movement-engine'
import {
  fulfillReservation,
  releaseReservationsForSource,
  reserveStock,
} from '#/server/inventory/reservation-service'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as reservationRepo from '#/server/repos/stock-reservation-repo'
import * as salesOrderRepo from '#/server/repos/sales-order-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface SalesOrderLineDraft {
  productId: string
  variantId?: string | null
  locationId: string
  uomId: string
  orderedQty: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discount?: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number
}

export interface CreateSalesOrderInput {
  customerId?: string | null
  warehouseId: string
  requestedDeliveryDate?: Date | null
  currencyCode?: string
  notes?: string | null
  priceListId?: string | null
  lines: Array<SalesOrderLineDraft>
}

const ZERO = new Prisma.Decimal(0)

export async function createSalesOrder(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateSalesOrderInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A sales order requires at least one line.')
  }

  let subtotal = ZERO
  let discountTotal = ZERO
  let taxTotal = ZERO

  const lines = input.lines.map((line) => {
    const qty = new Prisma.Decimal(line.orderedQty)
    const price = new Prisma.Decimal(line.unitPrice)
    const discount = new Prisma.Decimal(line.discount ?? 0)
    const tax = new Prisma.Decimal(line.taxAmount ?? 0)
    const gross = qty.times(price)

    subtotal = subtotal.plus(gross)
    discountTotal = discountTotal.plus(discount)
    taxTotal = taxTotal.plus(tax)

    return {
      productId: line.productId,
      variantId: line.variantId ?? null,
      locationId: line.locationId,
      uomId: line.uomId,
      orderedQty: qty,
      unitPrice: price,
      discount,
      taxAmount: tax,
      lineTotal: gross.minus(discount).plus(tax),
    }
  })

  const grandTotal = subtotal.minus(discountTotal).plus(taxTotal)

  const order = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'SALES_ORDER',
    })

    const created = await salesOrderRepo.createSalesOrder(
      tenantId,
      {
        documentNumber,
        customerId: input.customerId ?? null,
        warehouseId: input.warehouseId,
        requestedDeliveryDate: input.requestedDeliveryDate ?? null,
        currencyCode: input.currencyCode,
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        notes: input.notes ?? null,
        priceListId: input.priceListId ?? null,
        salesRepProfileId: context.profileId,
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
        actionKey: 'sales.order_create',
        entityType: 'sales_order',
        entityId: created.id,
        newValues: { documentNumber, grandTotal: grandTotal.toString() },
      },
      tx
    )

    return created
  })

  return serializeSalesOrder(order)
}

export async function confirmSalesOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const order = await salesOrderRepo.findSalesOrderById(tenantId, id)

  if (!order) {
    throw new NotFoundError('Sales order not found.')
  }

  assertTransition('salesOrder', order.status.toLowerCase(), 'confirmed')

  await prisma.$transaction(async (tx) => {
    await salesOrderRepo.updateSalesOrderStatus(tenantId, id, 'CONFIRMED', tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'sales.order_confirm',
        entityType: 'sales_order',
        entityId: id,
      },
      tx
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'sales_order.confirmed',
      aggregateType: 'sales_order',
      aggregateId: order.id,
      customerId: order.customerId,
      payload: {
        documentNumber: order.documentNumber,
        grandTotal: order.grandTotal.toString(),
        lines: order.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.orderedQty.toString(),
          unitPrice: line.unitPrice.toString(),
          lineTotal: line.lineTotal.toString(),
        })),
      },
      correlationId: order.correlationId,
      actorProfileId: context.profileId,
    })
  })

  const refreshed = await salesOrderRepo.findSalesOrderById(tenantId, id)

  return serializeSalesOrder(refreshed!)
}

// Confirmed → reserved: places a soft hold (raises `reserved`) on every line's
// pick grain so the ordered quantity can't be sold out from under the order. No
// stock leaves; only `available` drops until fulfilment or cancel.
export async function reserveSalesOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const reserved = await prisma.$transaction(
    async (tx) => {
      const order = await salesOrderRepo.findSalesOrderById(tenantId, id, tx)

      if (!order) {
        throw new NotFoundError('Sales order not found.')
      }

      assertTransition('salesOrder', order.status.toLowerCase(), 'reserved')

      for (const line of order.lines) {
        const ordered = new Prisma.Decimal(line.orderedQty)
        const alreadyReserved = new Prisma.Decimal(line.reservedQty)
        const toReserve = ordered.minus(alreadyReserved)

        if (toReserve.lte(ZERO)) {
          continue
        }

        await reserveStock(tx, tenantId, {
          reservationType: 'SALES_ORDER',
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: order.warehouseId,
          locationId: line.locationId,
          uomId: line.uomId,
          quantity: toReserve,
          sourceDocType: 'SALES_ORDER',
          sourceDocId: order.id,
          sourceDocLineId: line.id,
          sourceDocNumber: order.documentNumber,
          reservedByProfileId: context.profileId,
        })

        await salesOrderRepo.setLineReserved(line.id, ordered, tx)
      }

      await salesOrderRepo.updateSalesOrderStatus(tenantId, id, 'RESERVED', tx)

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'sales.order_reserve',
          entityType: 'sales_order',
          entityId: order.id,
          newValues: { documentNumber: order.documentNumber },
        },
        tx
      )

      const refreshed = await salesOrderRepo.findSalesOrderById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeSalesOrder(reserved)
}

// Fulfilment reduces stock: any open reservation for the line is converted first
// (releasing the hold off `reserved`), then a SALE (OUT) movement posts at its
// pick location with the WAC issue cost stamped onto the line for margin.
export async function fulfillSalesOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const fulfilled = await prisma.$transaction(
    async (tx) => {
      const order = await salesOrderRepo.findSalesOrderById(tenantId, id, tx)

      if (!order) {
        throw new NotFoundError('Sales order not found.')
      }

      assertTransition('salesOrder', order.status.toLowerCase(), 'fulfilled')

      for (const line of order.lines) {
        const qty = new Prisma.Decimal(line.orderedQty)

        if (qty.lte(ZERO)) {
          continue
        }

        // Convert any hold placed at reservation time so the oversell guard does
        // not count these units as both reserved and on-hand.
        const holds = await reservationRepo.findOpenReservationsForSourceLine(
          tenantId,
          line.id,
          tx
        )

        for (const hold of holds) {
          await fulfillReservation(tx, hold)
        }

        const result = await postMovement(tx, {
          tenantId,
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: order.warehouseId,
          locationId: line.locationId,
          movementType: 'SALE',
          direction: 'OUT',
          quantity: qty,
          uomId: line.uomId,
          sourceDocType: 'SALES_ORDER',
          sourceDocId: order.id,
          sourceDocLineId: line.id,
          sourceDocNumber: order.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: order.correlationId ?? undefined,
        })

        await salesOrderRepo.setLineFulfilled(
          line.id,
          { fulfilledQty: qty, costAtSale: result.movementUnitCost },
          tx
        )
      }

      await salesOrderRepo.updateSalesOrderStatus(tenantId, id, 'FULFILLED', tx)

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'sales.order_fulfill',
          entityType: 'sales_order',
          entityId: order.id,
          newValues: { documentNumber: order.documentNumber },
        },
        tx
      )

      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'sales_order.fulfilled',
        aggregateType: 'sales_order',
        aggregateId: order.id,
        customerId: order.customerId,
        payload: {
          documentNumber: order.documentNumber,
          grandTotal: order.grandTotal.toString(),
          lines: order.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.orderedQty.toString(),
            unitPrice: line.unitPrice.toString(),
            lineTotal: line.lineTotal.toString(),
          })),
        },
        correlationId: order.correlationId,
        actorProfileId: context.profileId,
      })

      const refreshed = await salesOrderRepo.findSalesOrderById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeSalesOrder(fulfilled)
}

// Cancelling frees any outstanding reservation holds back to available before
// closing the order.
export async function cancelSalesOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const cancelled = await prisma.$transaction(
    async (tx) => {
      const order = await salesOrderRepo.findSalesOrderById(tenantId, id, tx)

      if (!order) {
        throw new NotFoundError('Sales order not found.')
      }

      assertTransition('salesOrder', order.status.toLowerCase(), 'cancelled')

      await releaseReservationsForSource(tx, tenantId, order.id)
      await salesOrderRepo.updateSalesOrderStatus(tenantId, id, 'CANCELLED', tx)

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'sales.order_cancel',
          entityType: 'sales_order',
          entityId: id,
        },
        tx
      )

      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'sales_order.cancelled',
        aggregateType: 'sales_order',
        aggregateId: order.id,
        customerId: order.customerId,
        payload: { documentNumber: order.documentNumber },
        correlationId: order.correlationId,
        actorProfileId: context.profileId,
      })

      const refreshed = await salesOrderRepo.findSalesOrderById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeSalesOrder(cancelled)
}

export async function listSalesOrders(_context: CurrentUserContext, tenantId: string) {
  const orders = await salesOrderRepo.listSalesOrders(tenantId, {})

  return orders.map((order) => ({
    ...order,
    subtotal: order.subtotal.toString(),
    discountTotal: order.discountTotal.toString(),
    taxTotal: order.taxTotal.toString(),
    grandTotal: order.grandTotal.toString(),
  }))
}

export async function getSalesOrder(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const order = await salesOrderRepo.findSalesOrderById(tenantId, id)

  if (!order) {
    throw new NotFoundError('Sales order not found.')
  }

  return serializeSalesOrder(order)
}
