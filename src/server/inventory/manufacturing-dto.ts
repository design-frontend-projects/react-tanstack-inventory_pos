import type {
  BillOfMaterials,
  BomComponent,
  ProductionMaterial,
  ProductionOrder,
  ProductionOutput,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on Phase 10 manufacturing documents for the
// server-function boundary.

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeBom(bom: BillOfMaterials & { components: Array<BomComponent> }) {
  return {
    ...bom,
    outputQty: bom.outputQty.toString(),
    overheadCost: bom.overheadCost.toString(),
    components: bom.components.map((component) => ({
      ...component,
      quantity: component.quantity.toString(),
      scrapPercent: component.scrapPercent.toString(),
    })),
  }
}

export function serializeProductionOrder(
  order: ProductionOrder & {
    materials: Array<ProductionMaterial>
    outputs: Array<ProductionOutput>
  }
) {
  return {
    ...order,
    plannedQty: order.plannedQty.toString(),
    producedQty: order.producedQty.toString(),
    materialCost: order.materialCost.toString(),
    overheadCost: order.overheadCost.toString(),
    outputCost: order.outputCost.toString(),
    materials: order.materials.map((material) => ({
      ...material,
      plannedQty: material.plannedQty.toString(),
      consumedQty: material.consumedQty.toString(),
      unitCost: dec(material.unitCost),
    })),
    outputs: order.outputs.map((output) => ({
      ...output,
      quantity: output.quantity.toString(),
      unitCost: output.unitCost.toString(),
    })),
  }
}
