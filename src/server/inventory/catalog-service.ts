import { NotFoundError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import {
  serializeCustomer,
  serializeProduct,
  serializeProductWithVariants,
  serializeSupplier,
  serializeTaxRate,
} from '#/server/inventory/catalog-dto'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as brandRepo from '#/server/repos/brand-repo'
import * as categoryRepo from '#/server/repos/category-repo'
import * as customerRepo from '#/server/repos/customer-repo'
import * as productRepo from '#/server/repos/product-repo'
import * as supplierRepo from '#/server/repos/supplier-repo'
import * as taxRateRepo from '#/server/repos/tax-rate-repo'
import * as uomRepo from '#/server/repos/uom-repo'
import type { CurrentUserContext } from '#/types/auth'

// Service layer for the product catalog + master data. Handlers pass an already
// guarded context (tenant access + permission verified in the server function)
// plus the validated tenantId. Repos stay pure; the service translates missing
// rows into NotFoundError and records an audit-log entry on every write.

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

// --- Products ---------------------------------------------------------------

export async function listProducts(
  _context: CurrentUserContext,
  tenantId: string,
  filters: productRepo.ListProductsFilters,
) {
  const products = await productRepo.listProducts(tenantId, filters)

  return products.map(serializeProduct)
}

// Paged variant for the products workspace: items plus a filtered total so the
// client can render page controls. Same filters contract as listProducts.
export async function listProductsPage(
  _context: CurrentUserContext,
  tenantId: string,
  filters: productRepo.ListProductsFilters,
) {
  const [products, total] = await Promise.all([
    productRepo.listProducts(tenantId, filters),
    productRepo.countProducts(tenantId, filters),
  ])

  return { items: products.map(serializeProduct), total }
}

export async function getProduct(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const product = await productRepo.findProductById(tenantId, id)

  if (!product) {
    throw new NotFoundError('Product not found.')
  }

  return serializeProductWithVariants(product)
}

export async function createProduct(
  context: CurrentUserContext,
  tenantId: string,
  input: productRepo.ProductWriteInput,
) {
  const product = await productRepo.createProduct(tenantId, input)
  await audit(context, tenantId, 'product.create', 'product', product.id, {
    sku: product.sku,
    name: product.name,
  })

  return serializeProduct(product)
}

export async function updateProduct(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<productRepo.ProductWriteInput>,
) {
  const product = await productRepo.updateProduct(tenantId, id, input)

  if (!product) {
    throw new NotFoundError('Product not found.')
  }

  await audit(context, tenantId, 'product.update', 'product', product.id, {
    fields: Object.keys(input),
  })

  return serializeProductWithVariants(product)
}

export async function deleteProduct(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await productRepo.softDeleteProduct(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Product not found.')
  }

  await audit(context, tenantId, 'product.delete', 'product', id, null)

  return { id, deleted: true }
}

// --- Brands -----------------------------------------------------------------

export function listBrands(_context: CurrentUserContext, tenantId: string) {
  return brandRepo.listBrands(tenantId, { includeInactive: true })
}

export async function createBrand(
  context: CurrentUserContext,
  tenantId: string,
  input: brandRepo.BrandWriteInput,
) {
  const brand = await brandRepo.createBrand(tenantId, input)
  await audit(
    context,
    tenantId,
    'product.manage_categories',
    'brand',
    brand.id,
    {
      code: brand.code,
    },
  )

  return brand
}

export async function updateBrand(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<brandRepo.BrandWriteInput>,
) {
  const brand = await brandRepo.updateBrand(tenantId, id, input)

  if (!brand) {
    throw new NotFoundError('Brand not found.')
  }

  await audit(
    context,
    tenantId,
    'product.manage_categories',
    'brand',
    brand.id,
    null,
  )

  return brand
}

export async function deleteBrand(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await brandRepo.softDeleteBrand(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Brand not found.')
  }

  await audit(context, tenantId, 'product.manage_categories', 'brand', id, null)

  return { id, deleted: true }
}

// --- Categories -------------------------------------------------------------

export function listCategories(_context: CurrentUserContext, tenantId: string) {
  return categoryRepo.listCategories(tenantId, { includeInactive: true })
}

export async function createCategory(
  context: CurrentUserContext,
  tenantId: string,
  input: categoryRepo.CategoryWriteInput,
) {
  const category = await categoryRepo.createCategory(tenantId, input)
  await audit(
    context,
    tenantId,
    'product.manage_categories',
    'category',
    category.id,
    {
      code: category.code,
    },
  )

  return category
}

export async function updateCategory(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<categoryRepo.CategoryWriteInput>,
) {
  const category = await categoryRepo.updateCategory(tenantId, id, input)

  if (!category) {
    throw new NotFoundError('Category not found.')
  }

  await audit(
    context,
    tenantId,
    'product.manage_categories',
    'category',
    category.id,
    null,
  )

  return category
}

export async function deleteCategory(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await categoryRepo.softDeleteCategory(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Category not found.')
  }

  await audit(
    context,
    tenantId,
    'product.manage_categories',
    'category',
    id,
    null,
  )

  return { id, deleted: true }
}

// --- Units of measure -------------------------------------------------------

export function listUoms(_context: CurrentUserContext, tenantId: string) {
  return uomRepo.listUoms(tenantId, { includeInactive: true })
}

export async function createUom(
  context: CurrentUserContext,
  tenantId: string,
  input: uomRepo.UomWriteInput,
) {
  const uom = await uomRepo.createUom(tenantId, input)
  await audit(
    context,
    tenantId,
    'product.manage_categories',
    'unit_of_measure',
    uom.id,
    {
      code: uom.code,
    },
  )

  return uom
}

export async function updateUom(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<uomRepo.UomWriteInput>,
) {
  const uom = await uomRepo.updateUom(tenantId, id, input)

  if (!uom) {
    throw new NotFoundError('Unit of measure not found.')
  }

  await audit(
    context,
    tenantId,
    'product.manage_categories',
    'unit_of_measure',
    uom.id,
    null,
  )

  return uom
}

// --- Suppliers --------------------------------------------------------------

export async function listSuppliers(
  _context: CurrentUserContext,
  tenantId: string,
  search?: string,
) {
  const suppliers = await supplierRepo.listSuppliers(tenantId, {
    search,
    includeInactive: true,
  })

  return suppliers.map(serializeSupplier)
}

export async function createSupplier(
  context: CurrentUserContext,
  tenantId: string,
  input: supplierRepo.SupplierWriteInput,
) {
  const supplier = await supplierRepo.createSupplier(tenantId, input)
  await audit(context, tenantId, 'supplier.manage', 'supplier', supplier.id, {
    code: supplier.code,
  })

  return serializeSupplier(supplier)
}

export async function updateSupplier(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<supplierRepo.SupplierWriteInput>,
) {
  const supplier = await supplierRepo.updateSupplier(tenantId, id, input)

  if (!supplier) {
    throw new NotFoundError('Supplier not found.')
  }

  await audit(
    context,
    tenantId,
    'supplier.manage',
    'supplier',
    supplier.id,
    null,
  )

  return serializeSupplier(supplier)
}

export async function deleteSupplier(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await supplierRepo.softDeleteSupplier(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Supplier not found.')
  }

  await audit(context, tenantId, 'supplier.manage', 'supplier', id, null)

  return { id, deleted: true }
}

// --- Customers --------------------------------------------------------------

export async function listCustomers(
  _context: CurrentUserContext,
  tenantId: string,
  search?: string,
) {
  const customers = await customerRepo.listCustomers(tenantId, {
    search,
    includeInactive: true,
  })

  return customers.map(serializeCustomer)
}

export async function createCustomer(
  context: CurrentUserContext,
  tenantId: string,
  input: customerRepo.CustomerWriteInput,
) {
  const customer = await prisma.$transaction(async (tx) => {
    const created = await customerRepo.createCustomer(tenantId, input, tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'customer.manage',
        entityType: 'customer',
        entityId: created.id,
        newValues: { code: created.code },
      },
      tx,
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'customer.created',
      aggregateType: 'customer',
      aggregateId: created.id,
      customerId: created.id,
      payload: {
        code: created.code,
        name: created.name,
        customerType: created.customerType,
        email: created.email,
        phone: created.phone,
      },
      actorProfileId: context.profileId,
    })

    return created
  })

  return serializeCustomer(customer)
}

export async function updateCustomer(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<customerRepo.CustomerWriteInput>,
) {
  const customer = await prisma.$transaction(async (tx) => {
    const updated = await customerRepo.updateCustomer(tenantId, id, input, tx)

    if (!updated) {
      throw new NotFoundError('Customer not found.')
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'customer.manage',
        entityType: 'customer',
        entityId: updated.id,
        newValues: null,
      },
      tx,
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'customer.updated',
      aggregateType: 'customer',
      aggregateId: updated.id,
      customerId: updated.id,
      payload: {
        code: updated.code,
        name: updated.name,
        customerType: updated.customerType,
        email: updated.email,
        phone: updated.phone,
      },
      actorProfileId: context.profileId,
    })

    return updated
  })

  return serializeCustomer(customer)
}

export async function deleteCustomer(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await customerRepo.softDeleteCustomer(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Customer not found.')
  }

  await audit(context, tenantId, 'customer.manage', 'customer', id, null)

  return { id, deleted: true }
}

// --- Tax rates --------------------------------------------------------------

export async function listTaxRates(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const taxRates = await taxRateRepo.listTaxRates(tenantId, {
    includeInactive: true,
  })

  return taxRates.map(serializeTaxRate)
}

export async function createTaxRate(
  context: CurrentUserContext,
  tenantId: string,
  input: taxRateRepo.TaxRateWriteInput,
) {
  const taxRate = await taxRateRepo.createTaxRate(tenantId, input)
  await audit(context, tenantId, 'tax.manage', 'tax_rate', taxRate.id, {
    code: taxRate.code,
  })

  return serializeTaxRate(taxRate)
}

export async function updateTaxRate(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<taxRateRepo.TaxRateWriteInput>,
) {
  const taxRate = await taxRateRepo.updateTaxRate(tenantId, id, input)

  if (!taxRate) {
    throw new NotFoundError('Tax rate not found.')
  }

  await audit(context, tenantId, 'tax.manage', 'tax_rate', taxRate.id, null)

  return serializeTaxRate(taxRate)
}
