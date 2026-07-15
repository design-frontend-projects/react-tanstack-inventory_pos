import { ConflictError, NotFoundError, ValidationError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createSerial, ensureLot } from '#/server/inventory/lot-serial-service'
import { serializeProductionOrder } from '#/server/inventory/manufacturing-dto'
import { postMovement } from '#/server/inventory/movement-engine'
import {
  explodeComponentQty,
  rollupOutputUnitCost,
} from '#/server/inventory/production-costing'
import { requiresSerial } from '#/server/inventory/tracking-policy'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as bomRepo from '#/server/repos/bom-repo'
import { getProductTracking } from '#/server/repos/product-repo'
import * as orderRepo from '#/server/repos/production-order-repo'
import type { ProductionMaterialInput } from '#/server/repos/production-order-repo'
import type { CurrentUserContext } from '#/types/auth'

export interface CreateProductionOrderInput {
  productId: string
  variantId?: string | null
  bomId?: string | null
  warehouseId: string
  outputLocationId: string
  // Single source location for BOM-exploded components (per-material overrides
  // are supported via the explicit `materials` list instead).
  materialLocationId?: string | null
  plannedQty: Prisma.Decimal | string | number
  overheadCost?: Prisma.Decimal | string | number
  plannedStartDate?: Date | null
  plannedEndDate?: Date | null
  notes?: string | null
  materials?: Array<ProductionMaterialInput>
}

export interface CompleteProductionInput {
  producedQty?: Prisma.Decimal | string | number
  lotNumber?: string | null
  expiryDate?: Date | null
  serialNumbers?: Array<string>
}

const ZERO = new Prisma.Decimal(0)

// Create a production order. When a BOM is referenced its components are exploded
// (scaled to plannedQty, scrap applied) into planned material lines; otherwise the
// caller supplies explicit materials. Overhead defaults from the BOM.
export async function createProductionOrder(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateProductionOrderInput
) {
  const plannedQty = new Prisma.Decimal(input.plannedQty)

  if (plannedQty.lte(ZERO)) {
    throw new ValidationError('Planned quantity must be positive.')
  }

  const order = await prisma.$transaction(async (tx) => {
    let materials: Array<ProductionMaterialInput> = input.materials ?? []
    let overheadCost = input.overheadCost

    if (input.bomId) {
      const bom = await bomRepo.findBomById(tenantId, input.bomId, tx)

      if (!bom) {
        throw new NotFoundError('Bill of materials not found.')
      }

      if (!input.materialLocationId) {
        throw new ValidationError('A material source location is required when using a BOM.')
      }

      const sourceLocationId = input.materialLocationId

      materials = bom.components.map((component) => ({
        componentProductId: component.componentProductId,
        componentVariantId: component.componentVariantId,
        fromLocationId: sourceLocationId,
        uomId: component.uomId,
        plannedQty: explodeComponentQty(
          component.quantity,
          component.scrapPercent,
          plannedQty,
          bom.outputQty
        ),
      }))

      if (overheadCost === undefined) {
        overheadCost = new Prisma.Decimal(bom.overheadCost)
      }
    }

    if (materials.length === 0) {
      throw new ConflictError('A production order requires at least one material line.')
    }

    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'PRODUCTION_ORDER',
    })

    const created = await orderRepo.createProductionOrder(
      tenantId,
      {
        documentNumber,
        productId: input.productId,
        variantId: input.variantId ?? null,
        bomId: input.bomId ?? null,
        warehouseId: input.warehouseId,
        outputLocationId: input.outputLocationId,
        plannedQty,
        overheadCost: overheadCost ?? 0,
        plannedStartDate: input.plannedStartDate ?? null,
        plannedEndDate: input.plannedEndDate ?? null,
        notes: input.notes ?? null,
        createdByProfileId: context.profileId,
        materials,
      },
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'production.order_create',
        entityType: 'production_order',
        entityId: created.id,
        newValues: { documentNumber, plannedQty: plannedQty.toString() },
      },
      tx
    )

    return created
  })

  return serializeProductionOrder(order)
}

async function transitionOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  target: 'planned' | 'released' | 'cancelled',
  status: 'PLANNED' | 'RELEASED' | 'CANCELLED',
  actionKey: string
) {
  const order = await orderRepo.findProductionOrderById(tenantId, id)

  if (!order) {
    throw new NotFoundError('Production order not found.')
  }

  assertTransition('productionOrder', order.status.toLowerCase(), target)
  await orderRepo.updateProductionOrderStatus(tenantId, id, status)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType: 'production_order',
    entityId: id,
  })

  const refreshed = await orderRepo.findProductionOrderById(tenantId, id)

  return serializeProductionOrder(refreshed!)
}

export function planProductionOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionOrder(context, tenantId, id, 'planned', 'PLANNED', 'production.order_plan')
}

export function releaseProductionOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionOrder(context, tenantId, id, 'released', 'RELEASED', 'production.order_release')
}

// Consuming issues every planned material: a PRODUCTION_CONSUMPTION (OUT) per line
// at its source location, valued at current WAC. The issue costs accumulate into
// the order's material cost. Moves the order to IN_PROGRESS.
export async function consumeMaterials(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const order = await orderRepo.findProductionOrderById(tenantId, id, tx)

      if (!order) {
        throw new NotFoundError('Production order not found.')
      }

      assertTransition('productionOrder', order.status.toLowerCase(), 'in_progress')

      let materialCost = new Prisma.Decimal(order.materialCost)

      for (const material of order.materials) {
        if (material.isConsumed) {
          continue
        }

        const qty = new Prisma.Decimal(material.plannedQty)

        if (qty.lte(ZERO)) {
          continue
        }

        const movement = await postMovement(tx, {
          tenantId,
          productId: material.componentProductId,
          variantId: material.componentVariantId,
          warehouseId: order.warehouseId,
          locationId: material.fromLocationId,
          lotId: material.lotId,
          serialId: material.serialId,
          movementType: 'PRODUCTION_CONSUMPTION',
          direction: 'OUT',
          quantity: qty,
          uomId: material.uomId,
          sourceDocType: 'PRODUCTION',
          sourceDocId: order.id,
          sourceDocLineId: material.id,
          sourceDocNumber: order.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: order.correlationId ?? undefined,
        })

        await orderRepo.setMaterialConsumed(
          material.id,
          { consumedQty: qty, unitCost: movement.movementUnitCost },
          tx
        )

        materialCost = materialCost.plus(qty.times(movement.movementUnitCost))
      }

      await orderRepo.setProductionCosts(tenantId, id, { materialCost }, tx)
      await orderRepo.updateProductionOrderStatus(tenantId, id, 'IN_PROGRESS', tx)

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'production.consume',
          entityType: 'production_order',
          entityId: order.id,
          newValues: { materialCost: materialCost.toString() },
        },
        tx
      )

      const refreshed = await orderRepo.findProductionOrderById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeProductionOrder(result)
}

// Completing receives the finished goods: a PRODUCTION_OUTPUT (IN) at the rolled-up
// unit cost = (material cost + overhead) / produced qty, which flows into the
// finished product's weighted average. Lot/serial-tracked outputs materialize their
// masters, mirroring goods receipt.
export async function completeProduction(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: CompleteProductionInput
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const order = await orderRepo.findProductionOrderById(tenantId, id, tx)

      if (!order) {
        throw new NotFoundError('Production order not found.')
      }

      assertTransition('productionOrder', order.status.toLowerCase(), 'completed')

      const producedQty = new Prisma.Decimal(input.producedQty ?? order.plannedQty)

      if (producedQty.lte(ZERO)) {
        throw new ValidationError('Produced quantity must be positive.')
      }

      const materialCost = new Prisma.Decimal(order.materialCost)
      const overheadCost = new Prisma.Decimal(order.overheadCost)
      const unitCost = rollupOutputUnitCost(materialCost, overheadCost, producedQty)

      const tracking = await getProductTracking(tenantId, order.productId, tx)

      if (!tracking) {
        throw new NotFoundError('Finished product not found.')
      }

      const policy = tracking.trackingPolicy
      const outputUomId = tracking.baseUomId

      let lotId: string | null = null

      if ((policy === 'LOT' || policy === 'LOT_SERIAL') && input.lotNumber) {
        const lot = await ensureLot(tx, tenantId, {
          productId: order.productId,
          variantId: order.variantId,
          lotNumber: input.lotNumber,
          expiryDate: input.expiryDate,
          receivedDate: new Date(),
          initialQty: producedQty,
          sourceDocType: 'PRODUCTION',
          sourceDocId: order.id,
        })
        lotId = lot.id
      }

      if (requiresSerial(policy)) {
        const serials = input.serialNumbers ?? []

        if (new Prisma.Decimal(serials.length).lt(producedQty)) {
          throw new ConflictError(
            `${serials.length} serial number(s) for ${producedQty.toString()} produced units.`
          )
        }

        let lineNo = 0

        for (const serialNumber of serials) {
          const serial = await createSerial(tx, tenantId, {
            productId: order.productId,
            variantId: order.variantId,
            serialNumber,
            status: 'IN_STOCK',
            currentWarehouseId: order.warehouseId,
            currentLocationId: order.outputLocationId,
            lotId,
            sourceDocType: 'PRODUCTION',
            sourceDocId: order.id,
          })

          await postMovement(tx, {
            tenantId,
            productId: order.productId,
            variantId: order.variantId,
            warehouseId: order.warehouseId,
            locationId: order.outputLocationId,
            lotId,
            serialId: serial.id,
            movementType: 'PRODUCTION_OUTPUT',
            direction: 'IN',
            quantity: 1,
            uomId: outputUomId,
            unitCost,
            sourceDocType: 'PRODUCTION',
            sourceDocId: order.id,
            sourceDocNumber: order.documentNumber,
            performedByProfileId: context.profileId,
            correlationId: order.correlationId ?? undefined,
            trackingPolicy: policy,
          })

          lineNo += 1
          await orderRepo.addProductionOutput(
            tenantId,
            order.id,
            {
              lineNo,
              productId: order.productId,
              variantId: order.variantId,
              toLocationId: order.outputLocationId,
              uomId: outputUomId,
              quantity: 1,
              unitCost,
              lotId,
            },
            tx
          )
        }
      } else {
        await postMovement(tx, {
          tenantId,
          productId: order.productId,
          variantId: order.variantId,
          warehouseId: order.warehouseId,
          locationId: order.outputLocationId,
          lotId,
          movementType: 'PRODUCTION_OUTPUT',
          direction: 'IN',
          quantity: producedQty,
          uomId: outputUomId,
          unitCost,
          sourceDocType: 'PRODUCTION',
          sourceDocId: order.id,
          sourceDocNumber: order.documentNumber,
          performedByProfileId: context.profileId,
          correlationId: order.correlationId ?? undefined,
          trackingPolicy: policy,
        })

        await orderRepo.addProductionOutput(
          tenantId,
          order.id,
          {
            lineNo: 1,
            productId: order.productId,
            variantId: order.variantId,
            toLocationId: order.outputLocationId,
            uomId: outputUomId,
            quantity: producedQty,
            unitCost,
            lotId,
          },
          tx
        )
      }

      await orderRepo.setProductionCosts(
        tenantId,
        id,
        { outputCost: unitCost.times(producedQty), producedQty },
        tx
      )
      await orderRepo.updateProductionOrderStatus(tenantId, id, 'COMPLETED', tx)

      await createAuditLog(
        {
          tenantId,
          actorProfileId: context.profileId,
          actorEmail: context.email,
          actionKey: 'production.complete',
          entityType: 'production_order',
          entityId: order.id,
          newValues: {
            producedQty: producedQty.toString(),
            unitCost: unitCost.toString(),
          },
        },
        tx
      )

      const refreshed = await orderRepo.findProductionOrderById(tenantId, id, tx)

      return refreshed!
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return serializeProductionOrder(result)
}

export function cancelProductionOrder(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  return transitionOrder(context, tenantId, id, 'cancelled', 'CANCELLED', 'production.order_cancel')
}

export async function listProductionOrders(_context: CurrentUserContext, tenantId: string) {
  const orders = await orderRepo.listProductionOrders(tenantId, {})

  return orders.map((order) => ({
    ...order,
    plannedQty: order.plannedQty.toString(),
    producedQty: order.producedQty.toString(),
    materialCost: order.materialCost.toString(),
    overheadCost: order.overheadCost.toString(),
    outputCost: order.outputCost.toString(),
  }))
}

export async function getProductionOrder(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const order = await orderRepo.findProductionOrderById(tenantId, id)

  if (!order) {
    throw new NotFoundError('Production order not found.')
  }

  return serializeProductionOrder(order)
}
