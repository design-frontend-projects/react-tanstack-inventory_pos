import { NotFoundError } from '#/server/auth/errors'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as locationRepo from '#/server/repos/location-repo'
import * as warehouseRepo from '#/server/repos/warehouse-repo'
import type { CurrentUserContext } from '#/types/auth'

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string | null
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
  })
}

// --- Warehouses -------------------------------------------------------------

export function listWarehouses(_context: CurrentUserContext, tenantId: string) {
  return warehouseRepo.listWarehouses(tenantId, { includeInactive: true })
}

export async function createWarehouse(
  context: CurrentUserContext,
  tenantId: string,
  input: warehouseRepo.WarehouseWriteInput
) {
  const warehouse = await warehouseRepo.createWarehouse(tenantId, input)
  await audit(context, tenantId, 'warehouse.create', 'warehouse', warehouse.id)

  return warehouse
}

export async function updateWarehouse(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<warehouseRepo.WarehouseWriteInput>
) {
  const warehouse = await warehouseRepo.updateWarehouse(tenantId, id, input)

  if (!warehouse) {
    throw new NotFoundError('Warehouse not found.')
  }

  await audit(context, tenantId, 'warehouse.update', 'warehouse', warehouse.id)

  return warehouse
}

export async function deleteWarehouse(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const deleted = await warehouseRepo.softDeleteWarehouse(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Warehouse not found.')
  }

  await audit(context, tenantId, 'warehouse.delete', 'warehouse', id)

  return { id, deleted: true }
}

// --- Locations --------------------------------------------------------------

export function listLocations(
  _context: CurrentUserContext,
  tenantId: string,
  warehouseId: string
) {
  return locationRepo.listLocations(tenantId, warehouseId, { includeInactive: true })
}

export async function createLocation(
  context: CurrentUserContext,
  tenantId: string,
  input: locationRepo.LocationWriteInput
) {
  const location = await locationRepo.createLocation(tenantId, input)
  await audit(context, tenantId, 'warehouse.manage_locations', 'warehouse_location', location.id)

  return location
}

export async function updateLocation(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<Omit<locationRepo.LocationWriteInput, 'warehouseId'>>
) {
  const location = await locationRepo.updateLocation(tenantId, id, input)

  if (!location) {
    throw new NotFoundError('Location not found.')
  }

  await audit(context, tenantId, 'warehouse.manage_locations', 'warehouse_location', location.id)

  return location
}

export async function deleteLocation(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const deleted = await locationRepo.softDeleteLocation(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Location not found.')
  }

  await audit(context, tenantId, 'warehouse.manage_locations', 'warehouse_location', id)

  return { id, deleted: true }
}
