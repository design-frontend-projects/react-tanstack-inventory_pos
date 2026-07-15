import { computeReorderSuggestion } from '#/server/inventory/reorder-logic'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { ReorderRule } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as reorderRepo from '#/server/repos/reorder-rule-repo'
import type { ReorderRuleInput } from '#/server/repos/reorder-rule-repo'
import type { CurrentUserContext } from '#/types/auth'

function serializeRule(rule: ReorderRule) {
  return {
    ...rule,
    minStock: rule.minStock.toString(),
    maxStock: rule.maxStock.toString(),
    safetyStock: rule.safetyStock.toString(),
    reorderPoint: rule.reorderPoint.toString(),
    reorderQty: rule.reorderQty.toString(),
    economicOrderQty: rule.economicOrderQty === null ? null : rule.economicOrderQty.toString(),
  }
}

export async function upsertReorderRule(
  context: CurrentUserContext,
  tenantId: string,
  input: ReorderRuleInput
) {
  const rule = await reorderRepo.upsertReorderRule(tenantId, input)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'inventory.reorder_upsert',
    entityType: 'reorder_rule',
    entityId: rule.id,
    newValues: { productId: input.productId, warehouseId: input.warehouseId },
  })

  return serializeRule(rule)
}

export async function listReorderRules(_context: CurrentUserContext, tenantId: string) {
  const rules = await reorderRepo.listReorderRules(tenantId, {})

  return rules.map(serializeRule)
}

export async function deleteReorderRule(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const deleted = await reorderRepo.deleteReorderRule(tenantId, id)

  if (deleted) {
    await createAuditLog({
      tenantId,
      actorProfileId: context.profileId,
      actorEmail: context.email,
      actionKey: 'inventory.reorder_delete',
      entityType: 'reorder_rule',
      entityId: id,
    })
  }

  return { deleted }
}

// Compares live available stock (on-hand − reserved, aggregated per product ×
// warehouse) against each active reorder rule's point and returns the lines that
// need replenishing, with a suggested order quantity and preferred supplier.
export async function getReorderSuggestions(
  _context: CurrentUserContext,
  tenantId: string,
  warehouseId?: string
) {
  const rules = await reorderRepo.listReorderRules(
    tenantId,
    warehouseId ? { warehouseId } : {}
  )

  const suggestions = []

  for (const rule of rules) {
    if (!rule.isActive) {
      continue
    }

    const agg = await prisma.stockBalance.aggregate({
      where: { tenantId, productId: rule.productId, warehouseId: rule.warehouseId },
      _sum: { onHand: true, reserved: true },
    })

    const onHand = agg._sum.onHand ?? new Prisma.Decimal(0)
    const reserved = agg._sum.reserved ?? new Prisma.Decimal(0)

    const suggestion = computeReorderSuggestion(onHand, reserved, {
      reorderPoint: rule.reorderPoint,
      reorderQty: rule.reorderQty,
      maxStock: rule.maxStock,
    })

    if (!suggestion.belowPoint) {
      continue
    }

    suggestions.push({
      productId: rule.productId,
      variantId: rule.variantId,
      warehouseId: rule.warehouseId,
      available: suggestion.available.toString(),
      reorderPoint: rule.reorderPoint.toString(),
      suggestedQty: suggestion.suggestedQty.toString(),
      preferredSupplierId: rule.preferredSupplierId,
      leadTimeDays: rule.leadTimeDays,
    })
  }

  return suggestions
}
