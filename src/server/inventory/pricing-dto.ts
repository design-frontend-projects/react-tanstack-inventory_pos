import type {
  PriceList,
  ProductPrice,
} from '#/server/db/generated/prisma/client'

// Prisma Decimal columns are class instances and not JSON-serializable across
// the server-function boundary, so they are stringified (full precision kept).

type PriceListWithCount = PriceList & { _count: { prices: number } }

type ProductPriceWithRefs = ProductPrice & {
  product: { id: string; sku: string; name: string }
  priceList: { id: string; code: string; name: string }
}

export function serializePriceList(priceList: PriceListWithCount) {
  const { _count, ...rest } = priceList

  return {
    ...rest,
    priceCount: _count.prices,
  }
}

export function serializeProductPrice(price: ProductPriceWithRefs) {
  return {
    ...price,
    minQty: price.minQty.toString(),
    unitPrice: price.unitPrice.toString(),
  }
}

export type SerializedPriceList = ReturnType<typeof serializePriceList>
export type SerializedProductPrice = ReturnType<typeof serializeProductPrice>
