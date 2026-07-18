import { prisma } from '#/server/db/client'
import type { ResFloorStaffRole } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Floor staff assignments: FLOOR_MANAGER rows are area-level, WAITER rows may
// narrow to a section or a single table. Scoped uniqueness is enforced by the
// service (find-then-upsert) because Postgres unique indexes treat NULLs as
// distinct values.

export interface FloorAssignmentWriteInput {
  branchId: string
  diningAreaId: string
  sectionId?: string | null
  tableId?: string | null
  profileId: string
  role: ResFloorStaffRole
}

export function listAssignments(
  tenantId: string,
  filters: { branchId: string; diningAreaId?: string },
  client: PrismaClientLike = prisma
) {
  return client.resFloorStaffAssignment.findMany({
    where: {
      tenantId,
      branchId: filters.branchId,
      isActive: true,
      ...(filters.diningAreaId ? { diningAreaId: filters.diningAreaId } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })
}

export function findAssignmentById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resFloorStaffAssignment.findFirst({ where: { id, tenantId } })
}

// Exact-scope probe used by the manual upsert (matches NULL section/table).
export function findScopedAssignment(
  tenantId: string,
  input: {
    diningAreaId: string
    sectionId: string | null
    tableId: string | null
    profileId: string
    role: ResFloorStaffRole
  },
  client: PrismaClientLike = prisma
) {
  return client.resFloorStaffAssignment.findFirst({
    where: {
      tenantId,
      diningAreaId: input.diningAreaId,
      sectionId: input.sectionId,
      tableId: input.tableId,
      profileId: input.profileId,
      role: input.role,
    },
  })
}

export function createAssignment(
  tenantId: string,
  input: FloorAssignmentWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resFloorStaffAssignment.create({
    data: {
      tenantId,
      branchId: input.branchId,
      diningAreaId: input.diningAreaId,
      sectionId: input.sectionId ?? null,
      tableId: input.tableId ?? null,
      profileId: input.profileId,
      role: input.role,
      isActive: true,
    },
  })
}

export async function updateAssignment(
  tenantId: string,
  id: string,
  data: { role?: ResFloorStaffRole; isActive?: boolean },
  client: PrismaClientLike = prisma
) {
  const result = await client.resFloorStaffAssignment.updateMany({
    where: { id, tenantId },
    data: {
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findAssignmentById(tenantId, id, client)
}

// One active floor manager per dining area: deactivate every other manager row.
export async function deactivateOtherAreaManagers(
  tenantId: string,
  diningAreaId: string,
  keepProfileId: string,
  client: PrismaClientLike = prisma
) {
  await client.resFloorStaffAssignment.updateMany({
    where: {
      tenantId,
      diningAreaId,
      role: 'FLOOR_MANAGER',
      isActive: true,
      NOT: { profileId: keepProfileId },
    },
    data: { isActive: false },
  })
}
