import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for the leave sub-domain: leave types, policies,
// per-employee balances, requests, and the approval trail. All reads filter by
// tenantId; balances are the single source of truth for entitlement accounting.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- Leave types ------------------------------------------------------------

export interface LeaveTypeWriteInput {
  code: string
  name: string
  nameAr?: string | null
  isPaid?: boolean
  affectsPayroll?: boolean
  requiresDocument?: boolean
  maxDaysPerYear?: string | number | null
  gender?: string | null
  colorHex?: string | null
  isActive?: boolean
}

export function listLeaveTypes(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveType.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findLeaveTypeById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveType.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createLeaveType(
  tenantId: string,
  input: LeaveTypeWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveType.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      isPaid: input.isPaid ?? true,
      affectsPayroll: input.affectsPayroll ?? false,
      requiresDocument: input.requiresDocument ?? false,
      maxDaysPerYear: input.maxDaysPerYear ?? null,
      gender: input.gender ?? null,
      colorHex: input.colorHex ?? null,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateLeaveType(
  tenantId: string,
  id: string,
  input: Partial<LeaveTypeWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrLeaveType.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.isPaid !== undefined ? { isPaid: input.isPaid } : {}),
      ...(input.affectsPayroll !== undefined
        ? { affectsPayroll: input.affectsPayroll }
        : {}),
      ...(input.requiresDocument !== undefined
        ? { requiresDocument: input.requiresDocument }
        : {}),
      ...(input.maxDaysPerYear !== undefined
        ? { maxDaysPerYear: input.maxDaysPerYear ?? null }
        : {}),
      ...(input.gender !== undefined ? { gender: input.gender ?? null } : {}),
      ...(input.colorHex !== undefined
        ? { colorHex: input.colorHex ?? null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findLeaveTypeById(tenantId, id, client)
}

export async function softDeleteLeaveType(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrLeaveType.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })
  return result.count > 0
}

// --- Leave balances ---------------------------------------------------------

export function listBalances(
  tenantId: string,
  filters: { employeeId?: string; year?: number } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveBalance.findMany({
    where: {
      tenantId,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.year ? { year: filters.year } : {}),
    },
    orderBy: { year: 'desc' },
  })
}

export function findBalance(
  tenantId: string,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveBalance.findFirst({
    where: { tenantId, employeeId, leaveTypeId, year },
  })
}

export interface BalanceUpsertInput {
  employeeId: string
  leaveTypeId: string
  year: number
  entitledDays?: string | number
  accruedDays?: string | number
}

export async function upsertBalance(
  tenantId: string,
  input: BalanceUpsertInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const existing = await findBalance(
    tenantId,
    input.employeeId,
    input.leaveTypeId,
    input.year,
    client,
  )
  if (existing) {
    return client.hrLeaveBalance.update({
      where: { id: existing.id },
      data: {
        ...(input.entitledDays !== undefined
          ? { entitledDays: input.entitledDays }
          : {}),
        ...(input.accruedDays !== undefined
          ? { accruedDays: input.accruedDays }
          : {}),
        updatedBy: actorId,
      },
    })
  }
  return client.hrLeaveBalance.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      entitledDays: input.entitledDays ?? 0,
      accruedDays: input.accruedDays ?? 0,
      balanceDays: input.entitledDays ?? 0,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

// Atomically shifts balance buckets (pending/used/balance) for a request
// lifecycle transition. Deltas are decimal-string amounts.
export function adjustBalance(
  tenantId: string,
  balanceId: string,
  deltas: { pending?: number; used?: number; balance?: number },
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveBalance.update({
    where: { id: balanceId },
    data: {
      ...(deltas.pending !== undefined
        ? { pendingDays: { increment: deltas.pending } }
        : {}),
      ...(deltas.used !== undefined
        ? { usedDays: { increment: deltas.used } }
        : {}),
      ...(deltas.balance !== undefined
        ? { balanceDays: { increment: deltas.balance } }
        : {}),
    },
  })
}

// --- Leave requests ---------------------------------------------------------

const requestInclude = {
  approvals: { orderBy: { stepOrder: 'asc' } },
} satisfies Prisma.HrLeaveRequestInclude

export type LeaveRequestWithApprovals = Prisma.HrLeaveRequestGetPayload<{
  include: typeof requestInclude
}>

export interface LeaveRequestCreateInput {
  employeeId: string
  leaveTypeId: string
  requestNumber: string
  startDate: Date
  endDate: Date
  totalDays: number
  isHalfDay?: boolean
  reason?: string | null
  contactDuringLeave?: string | null
  documentUrl?: string | null
  statusCode?: string
}

export function listRequests(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveRequest.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findRequestById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveRequest.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: requestInclude,
  })
}

export function createRequest(
  tenantId: string,
  input: LeaveRequestCreateInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveRequest.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      requestNumber: input.requestNumber,
      startDate: input.startDate,
      endDate: input.endDate,
      totalDays: input.totalDays,
      isHalfDay: input.isHalfDay ?? false,
      reason: input.reason ?? null,
      contactDuringLeave: input.contactDuringLeave ?? null,
      documentUrl: input.documentUrl ?? null,
      statusCode: input.statusCode ?? 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function updateRequestStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveRequest.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}

export function recordApproval(
  tenantId: string,
  input: {
    leaveRequestId: string
    approverId: string
    stepOrder: number
    decision: string
    comments?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.hrLeaveApproval.create({
    data: {
      tenantId,
      leaveRequestId: input.leaveRequestId,
      approverId: input.approverId,
      stepOrder: input.stepOrder,
      decision: input.decision,
      comments: input.comments ?? null,
      decidedAt: new Date(),
    },
  })
}
