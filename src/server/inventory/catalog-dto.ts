import type {
  Customer,
  Product,
  ProductVariant,
  Supplier,
  TaxRate,
} from '#/server/db/generated/prisma/client'

// Server functions cross the network boundary, so returns must be
// JSON-serializable. Prisma `Decimal` is a class instance and is not, so these
// mappers stringify decimal columns (preserving full precision) while leaving
// Date fields intact. Consumers parse the numeric strings as needed.

function decimalToString<T extends { toString: () => string }>(
  value: T | null,
): string | null {
  return value === null ? null : value.toString()
}

export function serializeProduct(product: Product) {
  return {
    ...product,
    standardCost: decimalToString(product.standardCost),
    defaultPrice: decimalToString(product.defaultPrice),
    weight: decimalToString(product.weight),
    reorderPoint: decimalToString(product.reorderPoint),
    reorderQty: decimalToString(product.reorderQty),
    minStock: decimalToString(product.minStock),
    maxStock: decimalToString(product.maxStock),
    safetyStock: decimalToString(product.safetyStock),
  }
}

export function serializeProductVariant(variant: ProductVariant) {
  return {
    ...variant,
    priceOverride: decimalToString(variant.priceOverride),
    costOverride: decimalToString(variant.costOverride),
    weight: decimalToString(variant.weight),
  }
}

export function serializeProductWithVariants(
  product: Product & { variants: Array<ProductVariant> },
) {
  return {
    ...serializeProduct(product),
    variants: product.variants.map(serializeProductVariant),
  }
}

export function serializeSupplier(supplier: Supplier) {
  return {
    ...supplier,
    creditLimit: decimalToString(supplier.creditLimit),
    // Spec 005 supplier extensions (Decimal → string for the wire)
    currentBalance: supplier.currentBalance.toString(),
    rating: decimalToString(supplier.rating),
  }
}

export function serializeCustomer(customer: Customer) {
  return {
    ...customer,
    creditLimit: decimalToString(customer.creditLimit),
  }
}

export function serializeTaxRate(taxRate: TaxRate) {
  return {
    ...taxRate,
    rate: taxRate.rate.toString(),
  }
}
