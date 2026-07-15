import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as catalog from '#/server/inventory/catalog-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  brandWriteSchema,
  categoryWriteSchema,
  customerWriteSchema,
  productCreateSchema,
  productStatusSchema,
  productTypeSchema,
  productUpdateSchema,
  supplierWriteSchema,
  taxRateWriteSchema,
  uomWriteSchema,
} from '#/features/products/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId
    ),
    permission
  )
}

// --- Products ---------------------------------------------------------------

export const listProductsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      filters: z
        .object({
          search: z.string().optional(),
          categoryId: z.string().uuid().optional(),
          brandId: z.string().uuid().optional(),
          productType: productTypeSchema.optional(),
          status: productStatusSchema.optional(),
          take: z.number().int().min(1).max(200).optional(),
          skip: z.number().int().min(0).optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.view')

    return catalog.listProducts(context, data.tenantId, data.filters ?? {})
  })

export const getProductServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.view')

    return catalog.getProduct(context, data.tenantId, data.id)
  })

export const createProductServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: productCreateSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.create')

    return catalog.createProduct(context, data.tenantId, data.input)
  })

export const updateProductServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: productUpdateSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.update')

    return catalog.updateProduct(context, data.tenantId, data.id, data.input)
  })

export const deleteProductServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.delete')

    return catalog.deleteProduct(context, data.tenantId, data.id)
  })

// --- Brands -----------------------------------------------------------------

export const listBrandsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.view')

    return catalog.listBrands(context, data.tenantId)
  })

export const createBrandServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: brandWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.createBrand(context, data.tenantId, data.input)
  })

export const updateBrandServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: brandWriteSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.updateBrand(context, data.tenantId, data.id, data.input)
  })

export const deleteBrandServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.deleteBrand(context, data.tenantId, data.id)
  })

// --- Categories -------------------------------------------------------------

export const listCategoriesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.view')

    return catalog.listCategories(context, data.tenantId)
  })

export const createCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: categoryWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.createCategory(context, data.tenantId, data.input)
  })

export const updateCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: categoryWriteSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.updateCategory(context, data.tenantId, data.id, data.input)
  })

export const deleteCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.deleteCategory(context, data.tenantId, data.id)
  })

// --- Units of measure -------------------------------------------------------

export const listUomsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.view')

    return catalog.listUoms(context, data.tenantId)
  })

export const createUomServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: uomWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.createUom(context, data.tenantId, data.input)
  })

export const updateUomServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: uomWriteSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'product.manage_categories')

    return catalog.updateUom(context, data.tenantId, data.id, data.input)
  })

// --- Suppliers --------------------------------------------------------------

export const listSuppliersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      search: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['supplier.view', 'supplier.manage'])

    return catalog.listSuppliers(context, data.tenantId, data.search)
  })

export const createSupplierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: supplierWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return catalog.createSupplier(context, data.tenantId, data.input)
  })

export const updateSupplierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: supplierWriteSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return catalog.updateSupplier(context, data.tenantId, data.id, data.input)
  })

export const deleteSupplierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return catalog.deleteSupplier(context, data.tenantId, data.id)
  })

// --- Customers --------------------------------------------------------------

export const listCustomersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      search: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['customer.view', 'customer.manage'])

    return catalog.listCustomers(context, data.tenantId, data.search)
  })

export const createCustomerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: customerWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'customer.manage')

    return catalog.createCustomer(context, data.tenantId, data.input)
  })

export const updateCustomerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: customerWriteSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'customer.manage')

    return catalog.updateCustomer(context, data.tenantId, data.id, data.input)
  })

export const deleteCustomerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema, id: idSchema })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'customer.manage')

    return catalog.deleteCustomer(context, data.tenantId, data.id)
  })

// --- Tax rates --------------------------------------------------------------

export const listTaxRatesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['product.view', 'tax.manage'])

    return catalog.listTaxRates(context, data.tenantId)
  })

export const createTaxRateServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      input: taxRateWriteSchema,
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'tax.manage')

    return catalog.createTaxRate(context, data.tenantId, data.input)
  })

export const updateTaxRateServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      accessToken: accessTokenSchema,
      tenantId: tenantIdSchema,
      id: idSchema,
      input: taxRateWriteSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'tax.manage')

    return catalog.updateTaxRate(context, data.tenantId, data.id, data.input)
  })
