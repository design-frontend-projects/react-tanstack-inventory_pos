import { prisma } from '#/server/db/client'
import { ConflictError, NotFoundError } from '#/server/auth/errors'
import {
  serializeBranch,
  serializeServiceChargeRule,
  serializeTaxConfig,
} from '#/server/restaurant/master-data/master-data-dto'
import * as restaurantRepo from '#/server/repos/res-restaurant-repo'
import * as branchRepo from '#/server/repos/res-branch-repo'
import * as tableRepo from '#/server/repos/res-table-repo'
import * as serviceTypeRepo from '#/server/repos/res-service-type-repo'
import * as kitchenStationRepo from '#/server/repos/res-kitchen-station-repo'
import * as taxConfigRepo from '#/server/repos/res-tax-config-repo'
import * as sequenceRepo from '#/server/repos/res-number-sequence-repo'
import type { CurrentUserContext } from '#/types/auth'
import type { ResSequenceType } from '#/server/db/generated/prisma/client'
import type {
  BranchCreateInput,
  RestaurantCreateInput,
  ServiceTypeCreateInput,
  TableCreateInput,
} from '#/features/restaurant/master-data/validation'

// The set of number sequences every new branch is provisioned with.
const DEFAULT_SEQUENCES: ReadonlyArray<{ type: ResSequenceType; prefix: string }> = [
  { type: 'ORDER', prefix: 'ORD-' },
  { type: 'INVOICE', prefix: 'INV-' },
  { type: 'KITCHEN_TICKET', prefix: 'KOT-' },
  { type: 'RESERVATION', prefix: 'RSV-' },
]

// --- Restaurants ------------------------------------------------------------

export function listRestaurants(_context: CurrentUserContext, tenantId: string) {
  return restaurantRepo.listRestaurants(tenantId, { includeInactive: true })
}

export function createRestaurant(
  context: CurrentUserContext,
  tenantId: string,
  input: RestaurantCreateInput
) {
  return restaurantRepo.createRestaurant(tenantId, {
    ...input,
    createdByProfileId: context.profileId,
  })
}

export async function getRestaurant(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const restaurant = await restaurantRepo.findRestaurantById(tenantId, id)
  if (!restaurant) {
    throw new NotFoundError('Restaurant not found')
  }
  return restaurant
}

// --- Branches ---------------------------------------------------------------

export async function listBranches(
  _context: CurrentUserContext,
  tenantId: string,
  restaurantId?: string
) {
  const branches = await branchRepo.listBranches(tenantId, {
    restaurantId,
    includeInactive: true,
  })
  return branches.map(serializeBranch)
}

// Creating a branch also provisions its default number sequences and a settings
// row, atomically. The owning restaurant must exist and belong to the tenant.
export async function createBranch(
  context: CurrentUserContext,
  tenantId: string,
  input: BranchCreateInput
) {
  const restaurant = await restaurantRepo.findRestaurantById(tenantId, input.restaurantId)
  if (!restaurant) {
    throw new NotFoundError('Owning restaurant not found')
  }

  const branch = await prisma.$transaction(async (tx) => {
    const created = await branchRepo.createBranch(
      tenantId,
      {
        ...input,
        addressJson: (input.addressJson ?? null) as never,
        createdByProfileId: context.profileId,
      },
      tx
    )

    for (const seq of DEFAULT_SEQUENCES) {
      await sequenceRepo.upsertSequence(
        tenantId,
        { branchId: created.id, sequenceType: seq.type, prefix: seq.prefix },
        tx
      )
    }

    await tx.resBranchSettings.create({
      data: { tenantId, branchId: created.id, settingsJson: {} },
    })

    return created
  })

  return serializeBranch(branch)
}

export async function getBranch(_context: CurrentUserContext, tenantId: string, id: string) {
  const branch = await branchRepo.findBranchById(tenantId, id)
  if (!branch) {
    throw new NotFoundError('Branch not found')
  }
  return serializeBranch(branch)
}

export function upsertBranchMember(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string; profileId: string; roleCode?: string | null; isActive?: boolean }
) {
  return branchRepo.upsertBranchMember(tenantId, input)
}

// --- Tables (dining area -> section -> table) -------------------------------

export function listDiningAreas(
  _context: CurrentUserContext,
  tenantId: string,
  branchId: string
) {
  return tableRepo.listDiningAreas(tenantId, branchId)
}

export function createDiningArea(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string; code: string; name: string; displayOrder?: number }
) {
  return tableRepo.createDiningArea(tenantId, input)
}

export function listTableSections(
  _context: CurrentUserContext,
  tenantId: string,
  branchId: string
) {
  return tableRepo.listTableSections(tenantId, branchId)
}

export function createTableSection(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string; diningAreaId: string; code: string; name: string; displayOrder?: number }
) {
  return tableRepo.createTableSection(tenantId, input)
}

export function listTables(_context: CurrentUserContext, tenantId: string, branchId: string) {
  return tableRepo.listTables(tenantId, branchId)
}

export async function createTable(
  _context: CurrentUserContext,
  tenantId: string,
  input: TableCreateInput
) {
  const branch = await branchRepo.findBranchById(tenantId, input.branchId)
  if (!branch) {
    throw new NotFoundError('Branch not found')
  }
  return tableRepo.createTable(tenantId, input)
}

// --- Service types ----------------------------------------------------------

export function listServiceTypes(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null
) {
  return serviceTypeRepo.listServiceTypes(tenantId, { branchId })
}

export function createServiceType(
  _context: CurrentUserContext,
  tenantId: string,
  input: ServiceTypeCreateInput
) {
  return serviceTypeRepo.createServiceType(tenantId, {
    ...input,
    settingsJson: (input.settingsJson ?? null) as never,
  })
}

// --- Kitchen stations -------------------------------------------------------

export function listKitchenStations(
  _context: CurrentUserContext,
  tenantId: string,
  branchId: string
) {
  return kitchenStationRepo.listKitchenStations(tenantId, branchId)
}

export function createKitchenStation(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string; code: string; name: string; displayOrder?: number }
) {
  return kitchenStationRepo.createKitchenStation(tenantId, input)
}

// --- Tax & service-charge configuration -------------------------------------

export async function listTaxConfigs(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null
) {
  const rows = await taxConfigRepo.listTaxConfigs(tenantId, { branchId })
  return rows.map(serializeTaxConfig)
}

export async function createTaxConfig(
  _context: CurrentUserContext,
  tenantId: string,
  input: Parameters<typeof taxConfigRepo.createTaxConfig>[1]
) {
  const created = await taxConfigRepo.createTaxConfig(tenantId, input)
  return serializeTaxConfig(created)
}

export async function listServiceChargeRules(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null
) {
  const rows = await taxConfigRepo.listServiceChargeRules(tenantId, { branchId })
  return rows.map(serializeServiceChargeRule)
}

export async function createServiceChargeRule(
  _context: CurrentUserContext,
  tenantId: string,
  input: Parameters<typeof taxConfigRepo.createServiceChargeRule>[1]
) {
  const created = await taxConfigRepo.createServiceChargeRule(tenantId, input)
  return serializeServiceChargeRule(created)
}

// --- Number sequences -------------------------------------------------------

export function listSequences(
  _context: CurrentUserContext,
  tenantId: string,
  branchId: string
) {
  return sequenceRepo.listSequences(tenantId, branchId)
}

// Issue the next formatted document number for a branch sequence. Wrapped so
// callers in later phases (orders, KDS) reuse the same atomic issuance.
export async function issueNumber(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string; sequenceType: ResSequenceType; periodKey?: string }
) {
  const branch = await branchRepo.findBranchById(tenantId, input.branchId)
  if (!branch) {
    throw new NotFoundError('Branch not found')
  }
  const issued = await sequenceRepo.issueNextNumber(tenantId, input)
  if (!issued.formatted) {
    throw new ConflictError('Failed to issue sequence number')
  }
  return { value: issued.value.toString(), formatted: issued.formatted }
}
