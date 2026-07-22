import { NotFoundError } from '#/server/auth/errors'
import {
  serializePriceList,
  serializeProductPrice,
} from '#/server/inventory/pricing-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as priceListRepo from '#/server/repos/price-list-repo'
import type { CurrentUserContext } from '#/types/auth'

// Service layer for price lists and tiered product prices. Callers pass an
// already guarded context (tenant access + permission verified in the server
// function). Every write records an audit-log entry.

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string | null,
  newValues?: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: newValues ?? null,
  })
}

// --- Price lists ------------------------------------------------------------

export async function listPriceLists(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const priceLists = await priceListRepo.listPriceLists(tenantId, {
    includeInactive: true,
  })

  return priceLists.map(serializePriceList)
}

export async function createPriceList(
  context: CurrentUserContext,
  tenantId: string,
  input: priceListRepo.PriceListWriteInput,
) {
  const priceList = await priceListRepo.createPriceList(tenantId, input)
  await audit(
    context,
    tenantId,
    'pricing.price_list_create',
    'price_list',
    priceList.id,
    { code: priceList.code, name: priceList.name, type: priceList.type },
  )

  return serializePriceList(priceList)
}

export async function updatePriceList(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<priceListRepo.PriceListWriteInput>,
) {
  const priceList = await priceListRepo.updatePriceList(tenantId, id, input)

  if (!priceList) {
    throw new NotFoundError('Price list not found.')
  }

  await audit(
    context,
    tenantId,
    'pricing.price_list_update',
    'price_list',
    priceList.id,
    { fields: Object.keys(input) },
  )

  return serializePriceList(priceList)
}

export async function deletePriceList(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await priceListRepo.softDeletePriceList(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Price list not found.')
  }

  await audit(
    context,
    tenantId,
    'pricing.price_list_delete',
    'price_list',
    id,
    null,
  )

  return { id, deleted: true }
}

// --- Product prices (tiers) -------------------------------------------------

export async function listProductPrices(
  _context: CurrentUserContext,
  tenantId: string,
  filters: { priceListId?: string; productId?: string } = {},
) {
  const prices = await priceListRepo.listProductPrices(tenantId, filters)

  return prices.map(serializeProductPrice)
}

export async function upsertProductPrice(
  context: CurrentUserContext,
  tenantId: string,
  input: priceListRepo.ProductPriceWriteInput,
) {
  const price = await priceListRepo.upsertProductPrice(tenantId, input)
  await audit(
    context,
    tenantId,
    'pricing.product_price_upsert',
    'product_price',
    price.id,
    {
      priceListId: price.priceListId,
      productId: price.productId,
      minQty: price.minQty.toString(),
      unitPrice: price.unitPrice.toString(),
    },
  )

  return serializeProductPrice(price)
}

export async function deleteProductPrice(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const existing = await priceListRepo.findProductPriceById(tenantId, id)

  if (!existing) {
    throw new NotFoundError('Price entry not found.')
  }

  await priceListRepo.deleteProductPrice(tenantId, id)
  await audit(
    context,
    tenantId,
    'pricing.product_price_delete',
    'product_price',
    id,
    { priceListId: existing.priceListId, productId: existing.productId },
  )

  return { id, deleted: true }
}
