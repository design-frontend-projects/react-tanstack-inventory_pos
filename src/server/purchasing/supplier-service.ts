import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as supplierRepo from '#/server/repos/supplier-repo'
import * as categoryRepo from '#/server/repos/pod-supplier-category-repo'
import * as contactRepo from '#/server/repos/pod-supplier-contact-repo'
import * as addressRepo from '#/server/repos/pod-supplier-address-repo'
import * as bankRepo from '#/server/repos/pod-supplier-bank-repo'
import {
  serializeSupplierAddress,
  serializeSupplierBankAccount,
  serializeSupplierCategory,
  serializeSupplierContact,
  serializeSupplierDetail,
  serializeSupplierSummary,
} from '#/server/purchasing/supplier-dto'
import type { CurrentUserContext } from '#/types/auth'

const DEFAULT_PAGE_SIZE = 25

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string,
  values: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: values ?? undefined,
  })
}

// --- Suppliers --------------------------------------------------------------

export interface ListSuppliersInput {
  search?: string
  categoryId?: string
  statusCode?: string
  includeInactive?: boolean
  page?: number
  pageSize?: number
}

export async function listSuppliers(
  _context: CurrentUserContext,
  tenantId: string,
  input: ListSuppliersInput = {},
) {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(
    200,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
  )
  const options = {
    search: input.search,
    categoryId: input.categoryId,
    statusCode: input.statusCode,
    includeInactive: input.includeInactive ?? false,
  }

  const [items, total] = await Promise.all([
    supplierRepo.listSuppliers(tenantId, {
      ...options,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    supplierRepo.countSuppliers(tenantId, options),
  ])

  return {
    items: items.map(serializeSupplierSummary),
    total,
    page,
    pageSize,
  }
}

export async function getSupplierDetail(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const supplier = await supplierRepo.findSupplierDetail(tenantId, id)

  if (!supplier) {
    throw new NotFoundError('Supplier not found.')
  }

  return serializeSupplierDetail(supplier)
}

export async function createSupplier(
  context: CurrentUserContext,
  tenantId: string,
  input: supplierRepo.SupplierWriteInput,
) {
  let supplier
  try {
    supplier = await supplierRepo.createSupplier(tenantId, {
      ...input,
      createdBy: context.profileId,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        `A supplier with code "${input.code}" already exists.`,
      )
    }
    throw error
  }

  await audit(context, tenantId, 'supplier.manage', 'supplier', supplier.id, {
    action: 'create',
    code: supplier.code,
  })

  return serializeSupplierSummary(supplier)
}

export async function updateSupplier(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<supplierRepo.SupplierWriteInput>,
) {
  let supplier
  try {
    supplier = await supplierRepo.updateSupplier(tenantId, id, {
      ...input,
      updatedBy: context.profileId,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('A supplier with that code already exists.')
    }
    throw error
  }

  if (!supplier) {
    throw new NotFoundError('Supplier not found.')
  }

  await audit(context, tenantId, 'supplier.manage', 'supplier', supplier.id, {
    action: 'update',
  })

  return serializeSupplierSummary(supplier)
}

export async function deleteSupplier(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await supplierRepo.softDeleteSupplier(tenantId, id, {
    deletedBy: context.profileId,
  })

  if (!deleted) {
    throw new NotFoundError('Supplier not found.')
  }

  await audit(context, tenantId, 'supplier.manage', 'supplier', id, {
    action: 'delete',
  })

  return { id }
}

async function assertSupplierExists(tenantId: string, supplierId: string) {
  const supplier = await supplierRepo.findSupplierById(tenantId, supplierId)

  if (!supplier) {
    throw new NotFoundError('Supplier not found.')
  }
}

// --- Contacts ---------------------------------------------------------------

export async function upsertSupplierContact(
  context: CurrentUserContext,
  tenantId: string,
  input: contactRepo.SupplierContactWriteInput & { id?: string | null },
) {
  await assertSupplierExists(tenantId, input.supplierId)

  if (input.id) {
    const updated = await contactRepo.updateSupplierContact(
      tenantId,
      input.id,
      input,
    )

    if (!updated) {
      throw new NotFoundError('Supplier contact not found.')
    }

    await audit(
      context,
      tenantId,
      'supplier.manage',
      'pod_supplier_contact',
      updated.id,
      {
        action: 'update',
      },
    )

    return serializeSupplierContact(updated)
  }

  const created = await contactRepo.createSupplierContact(tenantId, input)

  await audit(
    context,
    tenantId,
    'supplier.manage',
    'pod_supplier_contact',
    created.id,
    {
      action: 'create',
      supplierId: input.supplierId,
    },
  )

  return serializeSupplierContact(created)
}

export async function deleteSupplierContact(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await contactRepo.softDeleteSupplierContact(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Supplier contact not found.')
  }

  await audit(
    context,
    tenantId,
    'supplier.manage',
    'pod_supplier_contact',
    id,
    {
      action: 'delete',
    },
  )

  return { id }
}

// --- Addresses --------------------------------------------------------------

export async function upsertSupplierAddress(
  context: CurrentUserContext,
  tenantId: string,
  input: addressRepo.SupplierAddressWriteInput & { id?: string | null },
) {
  await assertSupplierExists(tenantId, input.supplierId)

  if (input.id) {
    const updated = await addressRepo.updateSupplierAddress(
      tenantId,
      input.id,
      input,
    )

    if (!updated) {
      throw new NotFoundError('Supplier address not found.')
    }

    await audit(
      context,
      tenantId,
      'supplier.manage',
      'pod_supplier_address',
      updated.id,
      {
        action: 'update',
      },
    )

    return serializeSupplierAddress(updated)
  }

  const created = await addressRepo.createSupplierAddress(tenantId, input)

  await audit(
    context,
    tenantId,
    'supplier.manage',
    'pod_supplier_address',
    created.id,
    {
      action: 'create',
      supplierId: input.supplierId,
    },
  )

  return serializeSupplierAddress(created)
}

export async function deleteSupplierAddress(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await addressRepo.softDeleteSupplierAddress(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Supplier address not found.')
  }

  await audit(
    context,
    tenantId,
    'supplier.manage',
    'pod_supplier_address',
    id,
    {
      action: 'delete',
    },
  )

  return { id }
}

// --- Bank accounts ----------------------------------------------------------

export async function upsertSupplierBankAccount(
  context: CurrentUserContext,
  tenantId: string,
  input: bankRepo.SupplierBankAccountWriteInput & { id?: string | null },
) {
  await assertSupplierExists(tenantId, input.supplierId)

  if (input.id) {
    const updated = await bankRepo.updateSupplierBankAccount(
      tenantId,
      input.id,
      input,
    )

    if (!updated) {
      throw new NotFoundError('Supplier bank account not found.')
    }

    await audit(
      context,
      tenantId,
      'supplier.manage',
      'pod_supplier_bank_account',
      updated.id,
      {
        action: 'update',
      },
    )

    return serializeSupplierBankAccount(updated)
  }

  const created = await bankRepo.createSupplierBankAccount(tenantId, input)

  await audit(
    context,
    tenantId,
    'supplier.manage',
    'pod_supplier_bank_account',
    created.id,
    {
      action: 'create',
      supplierId: input.supplierId,
    },
  )

  return serializeSupplierBankAccount(created)
}

export async function deleteSupplierBankAccount(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await bankRepo.softDeleteSupplierBankAccount(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Supplier bank account not found.')
  }

  await audit(
    context,
    tenantId,
    'supplier.manage',
    'pod_supplier_bank_account',
    id,
    {
      action: 'delete',
    },
  )

  return { id }
}

// --- Categories -------------------------------------------------------------

export async function listSupplierCategories(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const categories = await categoryRepo.listSupplierCategories(tenantId, {
    includeInactive: true,
  })

  return categories.map(serializeSupplierCategory)
}

export async function createSupplierCategory(
  context: CurrentUserContext,
  tenantId: string,
  input: categoryRepo.SupplierCategoryWriteInput,
) {
  let category
  try {
    category = await categoryRepo.createSupplierCategory(tenantId, input)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        `A supplier category with code "${input.code}" already exists.`,
      )
    }
    throw error
  }

  await audit(
    context,
    tenantId,
    'purchase.config_manage',
    'pod_supplier_category',
    category.id,
    {
      action: 'create',
      code: category.code,
    },
  )

  return serializeSupplierCategory(category)
}

export async function updateSupplierCategory(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<categoryRepo.SupplierCategoryWriteInput>,
) {
  const category = await categoryRepo.updateSupplierCategory(
    tenantId,
    id,
    input,
  )

  if (!category) {
    throw new NotFoundError('Supplier category not found.')
  }

  await audit(
    context,
    tenantId,
    'purchase.config_manage',
    'pod_supplier_category',
    id,
    {
      action: 'update',
    },
  )

  return serializeSupplierCategory(category)
}

export async function deleteSupplierCategory(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await categoryRepo.softDeleteSupplierCategory(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Supplier category not found.')
  }

  await audit(
    context,
    tenantId,
    'purchase.config_manage',
    'pod_supplier_category',
    id,
    {
      action: 'delete',
    },
  )

  return { id }
}
