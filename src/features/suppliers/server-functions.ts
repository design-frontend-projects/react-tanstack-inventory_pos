import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as supplierService from '#/server/purchasing/supplier-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  supplierAddressSchema,
  supplierBankSchema,
  supplierCategorySchema,
  supplierCategoryUpdateSchema,
  supplierContactSchema,
  supplierCreateSchema,
  supplierListSchema,
  supplierUpdateSchema,
} from '#/features/suppliers/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

const base = z.object({
  accessToken: accessTokenSchema,
  tenantId: tenantIdSchema,
})
const withId = base.extend({ id: idSchema })

// --- Suppliers --------------------------------------------------------------

export const listSuppliersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: supplierListSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.view')

    return supplierService.listSuppliers(
      context,
      data.tenantId,
      data.input ?? {},
    )
  })

export const getSupplierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.view')

    return supplierService.getSupplierDetail(context, data.tenantId, data.id)
  })

export const createSupplierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: supplierCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.createSupplier(context, data.tenantId, data.input)
  })

export const updateSupplierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: supplierUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.updateSupplier(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteSupplierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.deleteSupplier(context, data.tenantId, data.id)
  })

// --- Contacts ---------------------------------------------------------------

export const upsertSupplierContactServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: supplierContactSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.upsertSupplierContact(
      context,
      data.tenantId,
      data.input,
    )
  })

export const deleteSupplierContactServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.deleteSupplierContact(
      context,
      data.tenantId,
      data.id,
    )
  })

// --- Addresses --------------------------------------------------------------

export const upsertSupplierAddressServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: supplierAddressSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.upsertSupplierAddress(
      context,
      data.tenantId,
      data.input,
    )
  })

export const deleteSupplierAddressServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.deleteSupplierAddress(
      context,
      data.tenantId,
      data.id,
    )
  })

// --- Bank accounts ----------------------------------------------------------

export const upsertSupplierBankAccountServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: supplierBankSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.upsertSupplierBankAccount(
      context,
      data.tenantId,
      data.input,
    )
  })

export const deleteSupplierBankAccountServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.manage')

    return supplierService.deleteSupplierBankAccount(
      context,
      data.tenantId,
      data.id,
    )
  })

// --- Categories -------------------------------------------------------------

export const listSupplierCategoriesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'supplier.view')

    return supplierService.listSupplierCategories(context, data.tenantId)
  })

export const createSupplierCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: supplierCategorySchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return supplierService.createSupplierCategory(
      context,
      data.tenantId,
      data.input,
    )
  })

export const updateSupplierCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: supplierCategoryUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return supplierService.updateSupplierCategory(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteSupplierCategoryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return supplierService.deleteSupplierCategory(
      context,
      data.tenantId,
      data.id,
    )
  })
