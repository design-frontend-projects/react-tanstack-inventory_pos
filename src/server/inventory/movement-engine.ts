import { ValidationError } from '#/server/auth/errors'
import { applyMovement } from '#/server/inventory/costing'
import {
  assertTrackingCompliance,
  serialTransition,
} from '#/server/inventory/tracking-policy'
import { createCostLayer } from '#/server/repos/cost-layer-repo'
import { createMovement } from '#/server/repos/movement-repo'
import { getProductTracking } from '#/server/repos/product-repo'
import { updateSerialState } from '#/server/repos/serial-repo'
import { ensureAndLockBalance } from '#/server/repos/stock-balance-repo'
import { Prisma } from '#/server/db/generated/prisma/client'
import type {
  MovementType,
  SourceDocType,
  TrackingPolicy,
} from '#/server/db/generated/prisma/client'

// The movement engine is the ONLY code path that writes StockBalance. It appends
// an immutable InventoryMovement row and updates the materialized balance under a
// row lock, inside the caller's transaction. Documents call it from their
// confirm/complete/post actions; nothing else touches stock quantities.

export class InsufficientStockError extends ValidationError {
  constructor(message = 'Insufficient available stock for this issue.') {
    super(message)
  }
}

export interface PostMovementInput {
  tenantId: string
  productId: string
  variantId?: string | null
  warehouseId: string
  locationId: string
  lotId?: string | null
  serialId?: string | null
  movementType: MovementType
  direction: 'IN' | 'OUT'
  quantity: Prisma.Decimal | string | number // positive magnitude
  uomId: string
  unitCost?: Prisma.Decimal | string | number | null // required for IN; OUT uses WAC
  sourceDocType: SourceDocType
  sourceDocId?: string | null
  sourceDocLineId?: string | null
  sourceDocNumber?: string | null
  performedByProfileId: string
  occurredAt?: Date
  correlationId?: string | null
  counterpartyLocationId?: string | null
  notes?: string | null
  allowNegative?: boolean
  // The product's lot/serial policy. When omitted the engine looks it up so the
  // rule is always enforced; callers that already have it can pass it to skip the
  // lookup on the hot path.
  trackingPolicy?: TrackingPolicy | null
}

export interface PostMovementResult {
  movementId: string
  movementUnitCost: Prisma.Decimal
  onHand: Prisma.Decimal
  avgUnitCost: Prisma.Decimal
  totalValue: Prisma.Decimal
}

const ZERO = new Prisma.Decimal(0)

// Movements that draw down available stock and must respect the oversell guard.
function isIssue(direction: 'IN' | 'OUT'): boolean {
  return direction === 'OUT'
}

export async function postMovement(
  tx: Prisma.TransactionClient,
  input: PostMovementInput,
): Promise<PostMovementResult> {
  const quantity = new Prisma.Decimal(input.quantity)

  if (quantity.lte(ZERO)) {
    throw new ValidationError('Movement quantity must be a positive magnitude.')
  }

  // Enforce the product's lot/serial tracking policy (LOT needs a lot, SERIAL a
  // serial at qty 1). Look the policy up only when the caller did not supply it.
  const trackingPolicy =
    input.trackingPolicy ??
    (await getProductTracking(input.tenantId, input.productId, tx))
      ?.trackingPolicy ??
    'NONE'

  assertTrackingCompliance(trackingPolicy, {
    lotId: input.lotId,
    serialId: input.serialId,
    quantity,
  })

  // Phase 3 treats the supplied quantity as base-UoM quantity; UoM conversion is
  // layered in with the purchasing/sales documents.
  const qtyInBaseUom = quantity

  const balance = await ensureAndLockBalance(tx, {
    tenantId: input.tenantId,
    productId: input.productId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    locationId: input.locationId,
    lotId: input.lotId,
    serialId: input.serialId,
  })

  // Oversell guard: an issue may not drive available (onHand - reserved -
  // allocated) below zero unless explicitly allowed.
  if (isIssue(input.direction) && !input.allowNegative) {
    const available = balance.onHand
      .minus(balance.reserved)
      .minus(balance.allocated)

    if (quantity.gt(available)) {
      throw new InsufficientStockError(
        `Requested ${quantity.toString()} exceeds available ${available.toString()}.`,
      )
    }
  }

  const { state, movementUnitCost } = applyMovement(
    {
      onHand: balance.onHand,
      avgUnitCost: balance.avgUnitCost,
      totalValue: balance.totalValue,
    },
    input.direction,
    qtyInBaseUom,
    input.unitCost === undefined || input.unitCost === null
      ? null
      : new Prisma.Decimal(input.unitCost),
  )

  const signedQtyDelta =
    input.direction === 'IN' ? qtyInBaseUom : qtyInBaseUom.negated()
  const totalCost = qtyInBaseUom.times(movementUnitCost)
  const occurredAt = input.occurredAt ?? new Date()

  const movement = await createMovement(
    {
      tenantId: input.tenantId,
      movementType: input.movementType,
      productId: input.productId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      counterpartyLocationId: input.counterpartyLocationId,
      lotId: input.lotId,
      serialId: input.serialId,
      qtyDelta: signedQtyDelta,
      uomId: input.uomId,
      qtyInBaseUom,
      unitCost: movementUnitCost,
      totalCost,
      runningOnHand: state.onHand,
      runningAvgCost: state.avgUnitCost,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      sourceDocLineId: input.sourceDocLineId,
      sourceDocNumber: input.sourceDocNumber,
      performedByProfileId: input.performedByProfileId,
      occurredAt,
      correlationId: input.correlationId,
      notes: input.notes,
    },
    tx,
  )

  await tx.stockBalance.update({
    where: { id: balance.id },
    data: {
      onHand: state.onHand,
      avgUnitCost: state.avgUnitCost,
      totalValue: state.totalValue,
      version: { increment: 1 },
      lastMovementAt: occurredAt,
    },
  })

  // A receipt opens a cost layer (WAC records but does not consume it).
  if (input.direction === 'IN') {
    await createCostLayer(
      {
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId,
        locationId: input.locationId,
        lotId: input.lotId,
        sourceMovementId: movement.id,
        receivedAt: occurredAt,
        originalQty: qtyInBaseUom,
        unitCost: movementUnitCost,
      },
      tx,
    )
  }

  // Advance the serialized unit's lifecycle + whereabouts (the movement is
  // authoritative for a serial). Manual states (quarantine/repair) are handled by
  // the lot/serial service, not here.
  if (input.serialId) {
    const transition = serialTransition(input.movementType, input.direction)

    await updateSerialState(
      input.serialId,
      {
        status: transition.status,
        currentWarehouseId: transition.toTarget ? input.warehouseId : null,
        currentLocationId: transition.toTarget ? input.locationId : null,
        soldAt: transition.sold ? occurredAt : undefined,
      },
      tx,
    )
  }

  return {
    movementId: movement.id,
    movementUnitCost,
    onHand: state.onHand,
    avgUnitCost: state.avgUnitCost,
    totalValue: state.totalValue,
  }
}

export interface PostValueAdjustmentInput {
  tenantId: string
  productId: string
  variantId?: string | null
  warehouseId: string
  locationId: string
  lotId?: string | null
  serialId?: string | null
  movementType: MovementType // e.g. LANDED_COST_ADJUSTMENT, REVALUATION
  valueDelta: Prisma.Decimal | string | number // signed; qty is untouched
  uomId: string
  sourceDocType: SourceDocType
  sourceDocId?: string | null
  sourceDocLineId?: string | null
  sourceDocNumber?: string | null
  performedByProfileId: string
  occurredAt?: Date
  correlationId?: string | null
  notes?: string | null
}

export interface PostValueAdjustmentResult {
  movementId: string
  /** false when nothing is on hand — the value could not be absorbed into stock. */
  absorbed: boolean
  onHand: Prisma.Decimal
  avgUnitCost: Prisma.Decimal
  totalValue: Prisma.Decimal
}

// Value-only revaluation (landed cost, cost corrections): adjusts the balance's
// totalValue/avgUnitCost without moving quantity, recorded as a zero-qty
// movement row for the audit trail. When nothing is on hand the value cannot be
// absorbed (the goods have already been issued at the old cost) — the movement
// is still recorded and `absorbed: false` lets the caller expense the residual.
export async function postValueAdjustment(
  tx: Prisma.TransactionClient,
  input: PostValueAdjustmentInput,
): Promise<PostValueAdjustmentResult> {
  const valueDelta = new Prisma.Decimal(input.valueDelta)

  if (valueDelta.eq(ZERO)) {
    throw new ValidationError('Value adjustment must be non-zero.')
  }

  const balance = await ensureAndLockBalance(tx, {
    tenantId: input.tenantId,
    productId: input.productId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    locationId: input.locationId,
    lotId: input.lotId,
    serialId: input.serialId,
  })

  const absorbed = balance.onHand.gt(ZERO)
  const newTotalValue = absorbed
    ? balance.totalValue.plus(valueDelta)
    : balance.totalValue
  const newAvgCost = absorbed
    ? newTotalValue.div(balance.onHand)
    : balance.avgUnitCost
  const occurredAt = input.occurredAt ?? new Date()

  const movement = await createMovement(
    {
      tenantId: input.tenantId,
      movementType: input.movementType,
      productId: input.productId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      lotId: input.lotId,
      serialId: input.serialId,
      qtyDelta: ZERO,
      uomId: input.uomId,
      qtyInBaseUom: ZERO,
      unitCost: ZERO,
      totalCost: valueDelta,
      runningOnHand: balance.onHand,
      runningAvgCost: newAvgCost,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      sourceDocLineId: input.sourceDocLineId,
      sourceDocNumber: input.sourceDocNumber,
      performedByProfileId: input.performedByProfileId,
      occurredAt,
      correlationId: input.correlationId,
      notes: input.notes,
    },
    tx,
  )

  if (absorbed) {
    await tx.stockBalance.update({
      where: { id: balance.id },
      data: {
        totalValue: newTotalValue,
        avgUnitCost: newAvgCost,
        version: { increment: 1 },
        lastMovementAt: occurredAt,
      },
    })
  }

  return {
    movementId: movement.id,
    absorbed,
    onHand: balance.onHand,
    avgUnitCost: newAvgCost,
    totalValue: newTotalValue,
  }
}
