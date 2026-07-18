import { prisma } from '#/server/db/client'
import { ConflictError, NotFoundError, ValidationError } from '#/server/auth/errors'
import * as tableRepo from '#/server/repos/res-table-repo'
import * as floorStaffRepo from '#/server/repos/res-floor-staff-repo'
import * as orderRepo from '#/server/repos/res-order-repo'
import type { CurrentUserContext } from '#/types/auth'
import type {
  ResFloorStaffAssignment,
  ResFloorStaffRole,
} from '#/server/db/generated/prisma/client'
import type {
  DiningAreaUpdateInput,
  FloorAssignmentUpsertInput,
  TableSectionUpdateInput,
  TableStatusSetValue,
  TableUpdateInput,
} from '#/features/restaurant/floor/validation'

// Floor operations: dining-area/section/table lifecycle, staff assignment, and
// the aggregated live floor-status projection the operational screens poll or
// receive realtime invalidations for.

const ACTIVE_ORDER_STATUSES_EXCLUDED = [
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'VOIDED',
] as const

interface ProfileNameInfo {
  displayName: string
  email: string
}

async function loadProfileNames(
  profileIds: ReadonlyArray<string>
): Promise<Map<string, ProfileNameInfo>> {
  const uniqueIds = [...new Set(profileIds)]
  if (uniqueIds.length === 0) {
    return new Map()
  }

  const rows = await prisma.profile.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  })

  return new Map(
    rows.map((row) => [
      row.id,
      {
        displayName:
          [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email,
        email: row.email,
      },
    ])
  )
}

// --- Dining area / section / table lifecycle --------------------------------

export async function updateDiningArea(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: DiningAreaUpdateInput
) {
  const updated = await tableRepo.updateDiningArea(tenantId, id, input)
  if (!updated) {
    throw new NotFoundError('Dining area not found')
  }
  return updated
}

export async function deleteDiningArea(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const area = await tableRepo.findDiningAreaById(tenantId, id)
  if (!area) {
    throw new NotFoundError('Dining area not found')
  }

  const sectionCount = await tableRepo.countActiveSections(tenantId, id)
  if (sectionCount > 0) {
    throw new ConflictError('Remove or move the sections in this area first')
  }

  await tableRepo.softDeleteDiningArea(tenantId, id)
  return { deleted: true as const }
}

export async function updateTableSection(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: TableSectionUpdateInput
) {
  const updated = await tableRepo.updateTableSection(tenantId, id, input)
  if (!updated) {
    throw new NotFoundError('Table section not found')
  }
  return updated
}

export async function deleteTableSection(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const section = await tableRepo.findTableSectionById(tenantId, id)
  if (!section) {
    throw new NotFoundError('Table section not found')
  }

  const tableCount = await tableRepo.countActiveTables(tenantId, id)
  if (tableCount > 0) {
    throw new ConflictError('Remove or move the tables in this section first')
  }

  await tableRepo.softDeleteTableSection(tenantId, id)
  return { deleted: true as const }
}

export async function updateTable(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: TableUpdateInput
) {
  const updated = await tableRepo.updateTable(tenantId, id, input)
  if (!updated) {
    throw new NotFoundError('Table not found')
  }
  return updated
}

export async function deleteTable(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const table = await tableRepo.findTableById(tenantId, id)
  if (!table) {
    throw new NotFoundError('Table not found')
  }

  const activeOrder = await orderRepo.findActiveOrderForTable(
    tenantId,
    table.branchId,
    id
  )
  if (activeOrder) {
    throw new ConflictError('Table has an active order — settle it first')
  }

  await tableRepo.softDeleteTable(tenantId, id)
  return { deleted: true as const }
}

// Manual status flips only cover AVAILABLE / RESERVED / BLOCKED. OCCUPIED is
// derived from the presence of an active order in the floor-status projection.
export async function setTableStatus(
  _context: CurrentUserContext,
  tenantId: string,
  input: { tableId: string; status: TableStatusSetValue }
) {
  const table = await tableRepo.findTableById(tenantId, input.tableId)
  if (!table) {
    throw new NotFoundError('Table not found')
  }

  const activeOrder = await orderRepo.findActiveOrderForTable(
    tenantId,
    table.branchId,
    input.tableId
  )
  if (activeOrder) {
    throw new ConflictError('Table has an active order — settle it first')
  }

  return tableRepo.updateTable(tenantId, input.tableId, { status: input.status })
}

// --- Staff assignments ------------------------------------------------------

export interface FloorAssignmentView {
  id: string
  branchId: string
  diningAreaId: string
  sectionId: string | null
  tableId: string | null
  profileId: string
  role: ResFloorStaffRole
  displayName: string
  email: string
}

function toAssignmentView(
  assignment: ResFloorStaffAssignment,
  names: Map<string, ProfileNameInfo>
): FloorAssignmentView {
  const info = names.get(assignment.profileId)
  return {
    id: assignment.id,
    branchId: assignment.branchId,
    diningAreaId: assignment.diningAreaId,
    sectionId: assignment.sectionId,
    tableId: assignment.tableId,
    profileId: assignment.profileId,
    role: assignment.role,
    displayName: info?.displayName ?? 'Unknown member',
    email: info?.email ?? '',
  }
}

export async function listFloorAssignments(
  _context: CurrentUserContext,
  tenantId: string,
  branchId: string
): Promise<Array<FloorAssignmentView>> {
  const assignments = await floorStaffRepo.listAssignments(tenantId, { branchId })
  const names = await loadProfileNames(assignments.map((a) => a.profileId))
  return assignments.map((assignment) => toAssignmentView(assignment, names))
}

export async function upsertFloorAssignment(
  _context: CurrentUserContext,
  tenantId: string,
  input: FloorAssignmentUpsertInput
): Promise<FloorAssignmentView> {
  const area = await tableRepo.findDiningAreaById(tenantId, input.diningAreaId)
  if (!area || area.branchId !== input.branchId) {
    throw new NotFoundError('Dining area not found in this branch')
  }

  if (input.sectionId) {
    const section = await tableRepo.findTableSectionById(tenantId, input.sectionId)
    if (!section || section.diningAreaId !== input.diningAreaId) {
      throw new NotFoundError('Section not found in this dining area')
    }
  }

  if (input.tableId) {
    const table = await tableRepo.findTableById(tenantId, input.tableId)
    if (!table || table.sectionId !== input.sectionId) {
      throw new NotFoundError('Table not found in this section')
    }
  }

  const membership = await prisma.tenantUser.findFirst({
    where: { tenantId, profileId: input.profileId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (!membership) {
    throw new ValidationError('The selected member is not active in this workspace')
  }

  const scope = {
    diningAreaId: input.diningAreaId,
    sectionId: input.sectionId ?? null,
    tableId: input.tableId ?? null,
    profileId: input.profileId,
    role: input.role,
  }

  const assignment = await prisma.$transaction(async (tx) => {
    if (input.role === 'FLOOR_MANAGER') {
      await floorStaffRepo.deactivateOtherAreaManagers(
        tenantId,
        input.diningAreaId,
        input.profileId,
        tx
      )
    }

    const existing = await floorStaffRepo.findScopedAssignment(tenantId, scope, tx)
    if (existing) {
      const revived = await floorStaffRepo.updateAssignment(
        tenantId,
        existing.id,
        { isActive: true },
        tx
      )
      return revived ?? existing
    }

    return floorStaffRepo.createAssignment(
      tenantId,
      {
        branchId: input.branchId,
        diningAreaId: input.diningAreaId,
        sectionId: input.sectionId ?? null,
        tableId: input.tableId ?? null,
        profileId: input.profileId,
        role: input.role,
      },
      tx
    )
  })

  const names = await loadProfileNames([assignment.profileId])
  return toAssignmentView(assignment, names)
}

export async function removeFloorAssignment(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const assignment = await floorStaffRepo.findAssignmentById(tenantId, id)
  if (!assignment || !assignment.isActive) {
    throw new NotFoundError('Assignment not found')
  }

  await floorStaffRepo.updateAssignment(tenantId, id, { isActive: false })
  return { removed: true as const }
}

// --- Live floor status projection -------------------------------------------

export interface FloorStaffChip {
  assignmentId: string
  profileId: string
  displayName: string
}

export interface FloorTableStatus {
  id: string
  code: string
  seats: number
  minCapacity: number | null
  shape: string | null
  storedStatus: string
  effectiveStatus: string
  waiters: Array<FloorStaffChip>
  activeOrder: {
    id: string
    orderNumber: string
    status: string
    orderType: string
    guestCount: number
    grandTotal: string
    itemCount: number
    openedAt: string
  } | null
}

export interface FloorSectionStatus {
  id: string
  code: string
  name: string
  displayOrder: number
  waiters: Array<FloorStaffChip>
  tables: Array<FloorTableStatus>
}

export interface FloorAreaStatus {
  id: string
  code: string
  name: string
  displayOrder: number
  floorManager: { profileId: string; displayName: string } | null
  waiters: Array<FloorStaffChip>
  sections: Array<FloorSectionStatus>
}

export interface FloorStatusPayload {
  branchId: string
  generatedAt: string
  areas: Array<FloorAreaStatus>
}

// One aggregated round trip powering the live floor screen: hierarchy, staff,
// and per-table active-order summaries. OCCUPIED is derived here.
export async function getFloorStatus(
  _context: CurrentUserContext,
  tenantId: string,
  branchId: string
): Promise<FloorStatusPayload> {
  const [areas, sections, tables, assignments, activeOrders] = await Promise.all([
    tableRepo.listDiningAreas(tenantId, branchId),
    tableRepo.listTableSections(tenantId, branchId),
    tableRepo.listTables(tenantId, branchId),
    floorStaffRepo.listAssignments(tenantId, { branchId }),
    prisma.resOrder.findMany({
      where: {
        tenantId,
        branchId,
        tableId: { not: null },
        deletedAt: null,
        status: { notIn: [...ACTIVE_ORDER_STATUSES_EXCLUDED] },
      },
      include: { _count: { select: { items: true } } },
    }),
  ])

  const names = await loadProfileNames(assignments.map((a) => a.profileId))

  const ordersByTable = new Map(
    activeOrders
      .filter((order) => order.tableId)
      .map((order) => [order.tableId as string, order])
  )

  const toChip = (assignment: ResFloorStaffAssignment): FloorStaffChip => ({
    assignmentId: assignment.id,
    profileId: assignment.profileId,
    displayName: names.get(assignment.profileId)?.displayName ?? 'Unknown member',
  })

  const areaStatuses: Array<FloorAreaStatus> = areas.map((area) => {
    const areaAssignments = assignments.filter((a) => a.diningAreaId === area.id)
    const manager = areaAssignments.find((a) => a.role === 'FLOOR_MANAGER')
    const areaWaiters = areaAssignments.filter(
      (a) => a.role === 'WAITER' && !a.sectionId && !a.tableId
    )

    const areaSections = sections
      .filter((section) => section.diningAreaId === area.id)
      .map((section): FloorSectionStatus => {
        const sectionWaiters = areaAssignments.filter(
          (a) => a.role === 'WAITER' && a.sectionId === section.id && !a.tableId
        )

        const sectionTables = tables
          .filter((table) => table.sectionId === section.id)
          .map((table): FloorTableStatus => {
            const tableWaiters = areaAssignments.filter(
              (a) => a.role === 'WAITER' && a.tableId === table.id
            )
            const activeOrder = ordersByTable.get(table.id)

            return {
              id: table.id,
              code: table.code,
              seats: table.seats,
              minCapacity: table.minCapacity,
              shape: table.shape,
              storedStatus: table.status,
              effectiveStatus: activeOrder ? 'OCCUPIED' : table.status,
              waiters: tableWaiters.map(toChip),
              activeOrder: activeOrder
                ? {
                    id: activeOrder.id,
                    orderNumber: activeOrder.orderNumber,
                    status: activeOrder.status,
                    orderType: activeOrder.orderType,
                    guestCount: activeOrder.guestCount,
                    grandTotal: activeOrder.grandTotal.toString(),
                    itemCount: activeOrder._count.items,
                    openedAt: activeOrder.createdAt.toISOString(),
                  }
                : null,
            }
          })

        return {
          id: section.id,
          code: section.code,
          name: section.name,
          displayOrder: section.displayOrder,
          waiters: sectionWaiters.map(toChip),
          tables: sectionTables,
        }
      })

    return {
      id: area.id,
      code: area.code,
      name: area.name,
      displayOrder: area.displayOrder,
      floorManager: manager
        ? {
            profileId: manager.profileId,
            displayName:
              names.get(manager.profileId)?.displayName ?? 'Unknown member',
          }
        : null,
      waiters: areaWaiters.map(toChip),
      sections: areaSections,
    }
  })

  return {
    branchId,
    generatedAt: new Date().toISOString(),
    areas: areaStatuses,
  }
}
