import { ConflictError, NotFoundError, ValidationError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeSalesReturn } from '#/server/inventory/returns-dto'
import { postMovement } from '#/server/inventory/movement-engine'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type {
  PaymentMethod,
  SalesReturnReason,
} from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as posSaleRepo from '#/server/repos/pos-sale-repo'
import * as returnRepo from '#/server/repos/sales-return-repo'
import type { PrismaClientLike } from '#/server/db/types'
import type { SalesReturnWithLines } from '#/server/repos/sales-return-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface SalesReturnLineDraft {
  productId: string
  variantId?: string | null
  locationId: string
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discount?: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number
  costAtReturn?: Prisma.Decimal | string | number | null
  restock?: boolean
  originLineId?: string | null
  lotId?: string | null
  serialId?: string | null
}

export interface CreateSalesReturnInput {
  customerId?: string | null
  warehouseId: string
  salesOrderId?: string | null
  reason?: SalesReturnReason
  refundMethod?: PaymentMethod | null
  notes?: string | null
  lines: Array<SalesReturnLineDraft>
}

export interface RefundPosSaleInput {
  reason?: SalesReturnReason
  refundMethod?: PaymentMethod | null
  notes?: string | null
  // Optional partial refund: which sale lines and how much of each. When omitted,
  // the full remaining (unrefunded) quantity of every line is refunded.
  lines?: Array<{ saleLineId: string; quantity: Prisma.Decimal | string | number }>
}

const ZERO = new Prisma.Decimal(0)

interface ComputedLine {
  productId: string
  variantId: string | null
  locationId: string
  uomId: string
  quantity: Prisma.Decimal
  unitPrice: Prisma.Decimal
  discount: Prisma.Decimal
  taxAmount: Prisma.Decimal
  lineTotal: Prisma.Decimal
  costAtReturn: Prisma.Decimal | null
  restock: boolean
  originLineId: string | null
  lotId: string | null
  serialId: string | null
}

interface ReturnTotals {
  subtotal: Prisma.Decimal
  discountTotal: Prisma.Decimal
  taxTotal: Prisma.Decimal
  grandTotal: Prisma.Decimal
}

// Builds normalized lines + document totals from raw drafts.
function computeLines(lines: Array<SalesReturnLineDraft>): {
  computed: Array<ComputedLine>
  totals: ReturnTotals
} {
  let subtotal = ZERO
  let discountTotal = ZERO
  let taxTotal = ZERO

  const computed = lines.map((line) => {
    const qty = new Prisma.Decimal(line.quantity)
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
      quantity: qty,
      unitPrice: price,
      discount,
      taxAmount: tax,
      lineTotal: gross.minus(discount).plus(tax),
      costAtReturn:
        line.costAtReturn === undefined || line.costAtReturn === null
          ? null
          : new Prisma.Decimal(line.costAtReturn),
      restock: line.restock ?? true,
      originLineId: line.originLineId ?? null,
      lotId: line.lotId ?? null,
      serialId: line.serialId ?? null,
    }
  })

  return {
    computed,
    totals: {
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal: subtotal.minus(discountTotal).plus(taxTotal),
    },
  }
}

// Shared posting core: re-enters each restockable line into stock via a
// SALES_RETURN (IN) movement valued at the captured costAtReturn (falling back to
// current WAC when unknown), stamps the return posted, and writes the audit row.
// Runs inside the caller's transaction.
async function applyReturnReceipt(
  tx: Prisma.TransactionClient,
  tenantId: string,
  salesReturn: SalesReturnWithLines,
  context: CurrentUserContext
): Promise<Prisma.Decimal> {
  let restockValue = ZERO

  for (const line of salesReturn.lines) {
    if (!line.restock) {
      continue
    }

    const qty = new Prisma.Decimal(line.quantity)

    if (qty.lte(ZERO)) {
      continue
    }

    const result = await postMovement(tx, {
      tenantId,
      productId: line.productId,
      variantId: line.variantId,
      warehouseId: salesReturn.warehouseId,
      locationId: line.locationId,
      lotId: line.lotId,
      serialId: line.serialId,
      movementType: 'SALES_RETURN',
      direction: 'IN',
      quantity: qty,
      uomId: line.uomId,
      unitCost: line.costAtReturn ? new Prisma.Decimal(line.costAtReturn) : null,
      sourceDocType: 'RETURN',
      sourceDocId: salesReturn.id,
      sourceDocLineId: line.id,
      sourceDocNumber: salesReturn.documentNumber,
      performedByProfileId: context.profileId,
      correlationId: salesReturn.correlationId ?? undefined,
    })

    if (line.costAtReturn === null) {
      await returnRepo.setLineCostAtReturn(line.id, result.movementUnitCost, tx)
    }

    restockValue = restockValue.plus(qty.times(result.movementUnitCost))
  }

  await returnRepo.markReturnPosted(
    tenantId,
    salesReturn.id,
    {
      postedByProfileId: context.profileId,
      status: 'RECEIVED',
      restockValue,
    },
    tx
  )

  await createAuditLog(
    {
      tenantId,
      actorProfileId: context.profileId,
      actorEmail: context.email,
      actionKey: 'returns.receive',
      entityType: 'sales_return',
      entityId: salesReturn.id,
      newValues: {
        documentNumber: salesReturn.documentNumber,
        restockValue: restockValue.toString(),
      },
    },
    tx
  )

  return restockValue
}

export async function createSalesReturn(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateSalesReturnInput
) {
  if (input.lines.length === 0) {
    throw new ConflictError('A sales return requires at least one line.')
  }

  const { computed, totals } = computeLines(input.lines)

  const created = await prisma.$transaction(async (tx) => {
    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'SALES_RETURN',
    })

    const salesReturn = await returnRepo.createSalesReturn(
      tenantId,
      {
        documentNumber,
        customerId: input.customerId ?? null,
        warehouseId: input.warehouseId,
        originType: input.salesOrderId ? 'SALES_ORDER' : null,
        salesOrderId: input.salesOrderId ?? null,
        reason: input.reason,
        refundMethod: input.refundMethod ?? null,
        notes: input.notes ?? null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        createdByProfileId: context.profileId,
        lines: computed,
      },
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'returns.create',
        entityType: 'sales_return',
        entityId: salesReturn.id,
        newValues: { documentNumber, grandTotal: totals.grandTotal.toString() },
      },
      tx
    )

    return salesReturn
  })

  return serializeSalesReturn(created)
}

// Advances a return through its approval lifecycle (submit / approve / reject /
// cancel) without any inventory effect.
async function transitionReturn(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  target: 'requested' | 'approved' | 'rejected' | 'cancelled',
  actionKey: string,
  status:
    | 'REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED',
  client: PrismaClientLike = prisma
) {
  const salesReturn = await returnRepo.findSalesReturnById(tenantId, id, client)

  if (!salesReturn) {
    throw new NotFoundError('Sales return not found.')
  }

  assertTransition('salesReturn', salesReturn.status.toLowerCase(), target)
  await returnRepo.updateSalesReturnStatus(tenantId, id, status, client)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType: 'sales_return',
    entityId: id,
  })

  const refreshed = await returnRepo.findSalesReturnById(tenantId, id, client)

  return serializeSalesReturn(refreshed!)
}

export function submitSalesReturn(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionReturn(context, tenantId, id, 'requested', 'returns.submit', 'REQUESTED')
}

export function approveSalesReturn(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionReturn(context, tenantId, id, 'approved', 'returns.approve', 'APPROVED')
}

export function rejectSalesReturn(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionReturn(context, tenantId, id, 'rejected', 'returns.reject', 'REJECTED')
}

export function cancelSalesReturn(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionReturn(context, tenantId, id, 'cancelled', 'returns.cancel', 'CANCELLED')
}

// Receiving posts the return into stock (SALES_RETURN IN) for every restockable
// line, atomically. Only an approved / in-transit return may be received.
export async function receiveSalesReturn(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const received = await prisma.$transaction(
    async (tx) => {
      const salesReturn = await returnRepo.findSalesReturnById(tenantId, id, tx)

      if (!salesReturn) {
        throw new NotFoundError('Sales return not found.')
      }

      if (salesReturn.isPosted) {
        throw new ConflictError('Sales return is already received.')
      }

      assertTransition('salesReturn', salesReturn.status.toLowerCase(), 'received')

      await applyReturnReceipt(tx, tenantId, salesReturn, context)

      const refreshed = await returnRepo.findSalesReturnById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeSalesReturn(received)
}

// POS counter refund: creates an already-approved return sourced from a completed
// POS sale, re-enters stock immediately (SALES_RETURN IN at the original
// costAtSale), tracks per-line refunded quantity, and advances the sale to
// REFUNDED / PARTIALLY_REFUNDED — all in one transaction.
export async function refundPosSale(
  context: CurrentUserContext,
  tenantId: string,
  posSaleId: string,
  input: RefundPosSaleInput
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const sale = await posSaleRepo.findSaleById(tenantId, posSaleId, tx)

      if (!sale) {
        throw new NotFoundError('POS sale not found.')
      }

      const status = sale.status.toLowerCase()

      if (status !== 'completed' && status !== 'partially_refunded') {
        throw new ConflictError('Only a completed sale can be refunded.')
      }

      const requestedById = new Map<string, Prisma.Decimal>()

      if (input.lines && input.lines.length > 0) {
        for (const requested of input.lines) {
          requestedById.set(requested.saleLineId, new Prisma.Decimal(requested.quantity))
        }
      }

      const drafts: Array<SalesReturnLineDraft> = []
      const lineRefundQty = new Map<string, Prisma.Decimal>()

      for (const line of sale.lines) {
        const sold = new Prisma.Decimal(line.quantity)
        const alreadyRefunded = new Prisma.Decimal(line.refundedQty)
        const remaining = sold.minus(alreadyRefunded)

        const requestedQty = input.lines
          ? (requestedById.get(line.id) ?? ZERO)
          : remaining

        if (requestedQty.lte(ZERO)) {
          continue
        }

        if (requestedQty.gt(remaining)) {
          throw new ValidationError(
            `Refund quantity ${requestedQty.toString()} exceeds refundable ${remaining.toString()} for line ${line.id}.`
          )
        }

        lineRefundQty.set(line.id, requestedQty)
        drafts.push({
          productId: line.productId,
          variantId: line.variantId,
          locationId: sale.locationId,
          uomId: line.uomId,
          quantity: requestedQty,
          unitPrice: new Prisma.Decimal(line.unitPrice),
          discount: ZERO,
          taxAmount: ZERO,
          costAtReturn: line.costAtSale ? new Prisma.Decimal(line.costAtSale) : null,
          restock: true,
          originLineId: line.id,
        })
      }

      if (drafts.length === 0) {
        throw new ConflictError('Nothing left to refund on this sale.')
      }

      const { computed, totals } = computeLines(drafts)

      const documentNumber = await nextDocumentNumber(tx, {
        tenantId,
        documentType: 'SALES_RETURN',
      })

      const created = await returnRepo.createSalesReturn(
        tenantId,
        {
          documentNumber,
          customerId: sale.customerId,
          warehouseId: sale.warehouseId,
          originType: 'POS_SALE',
          posSaleId: sale.id,
          reason: input.reason,
          status: 'APPROVED',
          refundMethod: input.refundMethod ?? 'CASH',
          notes: input.notes ?? null,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          createdByProfileId: context.profileId,
          lines: computed,
        },
        tx
      )

      await applyReturnReceipt(tx, tenantId, created, context)

      // Track per-line refunded quantity and resolve the sale's new status.
      let fullyRefunded = true

      for (const line of sale.lines) {
        const refundQty = lineRefundQty.get(line.id) ?? ZERO

        if (refundQty.gt(ZERO)) {
          await posSaleRepo.incrementLineRefundedQty(line.id, refundQty, tx)
        }

        const totalRefunded = new Prisma.Decimal(line.refundedQty).plus(refundQty)

        if (totalRefunded.lt(new Prisma.Decimal(line.quantity))) {
          fullyRefunded = false
        }
      }

      const nextSaleStatus = fullyRefunded ? 'refunded' : 'partially_refunded'
      assertTransition('posSale', status, nextSaleStatus)
      await posSaleRepo.updateSaleStatus(
        tenantId,
        sale.id,
        fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        tx
      )

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'returns.refund',
          entityType: 'pos_sale',
          entityId: sale.id,
          newValues: {
            salesReturnId: created.id,
            documentNumber,
            saleStatus: nextSaleStatus,
          },
        },
        tx
      )

      const refreshed = await returnRepo.findSalesReturnById(tenantId, created.id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeSalesReturn(result)
}

export async function listSalesReturns(_context: CurrentUserContext, tenantId: string) {
  const returns = await returnRepo.listSalesReturns(tenantId, {})

  return returns.map(serializeSalesReturn)
}

export async function getSalesReturn(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const salesReturn = await returnRepo.findSalesReturnById(tenantId, id)

  if (!salesReturn) {
    throw new NotFoundError('Sales return not found.')
  }

  return serializeSalesReturn(salesReturn)
}
