import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for employee assets (inventory link) and the
// travel & expense sub-domain (travel requests, expense claims + lines,
// reimbursements).

// --- Employee assets --------------------------------------------------------

export interface AssetWriteInput {
  employeeId: string
  assetType: string
  name: string
  productId?: string | null
  finAssetId?: string | null
  serialNumber?: string | null
  assetTag?: string | null
  assignedDate?: Date | null
  conditionOut?: string | null
  value?: string | number | null
  currencyCode?: string
  notes?: string | null
}

export function listAssets(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeAsset.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
  })
}

export function findAssetById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeAsset.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createAsset(
  tenantId: string,
  input: AssetWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeAsset.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      assetType: input.assetType,
      name: input.name.trim(),
      productId: input.productId ?? null,
      finAssetId: input.finAssetId ?? null,
      serialNumber: input.serialNumber ?? null,
      assetTag: input.assetTag ?? null,
      assignedDate: input.assignedDate ?? new Date(),
      conditionOut: input.conditionOut ?? null,
      value: input.value ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      notes: input.notes ?? null,
      statusCode: 'assigned',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function returnAsset(
  tenantId: string,
  id: string,
  conditionIn: string | null,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrEmployeeAsset.updateMany({
    where: { id, tenantId, deletedAt: null, statusCode: 'assigned' },
    data: {
      statusCode: 'returned',
      returnedDate: new Date(),
      conditionIn,
      isActive: false,
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findAssetById(tenantId, id, client)
}

// --- Travel requests --------------------------------------------------------

export interface TravelWriteInput {
  employeeId: string
  requestNumber: string
  purpose: string
  destination?: string | null
  travelType?: string
  departDate?: Date | null
  returnDate?: Date | null
  estimatedCost?: string | number
  advanceAmount?: string | number
  currencyCode?: string
}

export function listTravel(
  tenantId: string,
  filters: { statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrTravelRequest.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function createTravel(
  tenantId: string,
  input: TravelWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrTravelRequest.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      requestNumber: input.requestNumber,
      purpose: input.purpose.trim(),
      destination: input.destination ?? null,
      travelType: input.travelType ?? 'domestic',
      departDate: input.departDate ?? null,
      returnDate: input.returnDate ?? null,
      estimatedCost: input.estimatedCost ?? 0,
      advanceAmount: input.advanceAmount ?? 0,
      currencyCode: input.currencyCode ?? 'USD',
      statusCode: 'submitted',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function updateTravelStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrTravelRequest.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}

// --- Expense claims ---------------------------------------------------------

const claimInclude = {
  lines: { orderBy: { lineNumber: 'asc' } },
} satisfies Prisma.HrExpenseClaimInclude

export type ExpenseClaimWithLines = Prisma.HrExpenseClaimGetPayload<{
  include: typeof claimInclude
}>

export interface ExpenseClaimCreateInput {
  employeeId: string
  claimNumber: string
  title: string
  travelRequestId?: string | null
  claimDate?: Date | null
  currencyCode?: string
  costCenterId?: string | null
  lines: Array<{
    expenseDate?: Date | null
    category?: string
    description?: string | null
    amount: string | number
    taxAmount?: string | number
    receiptUrl?: string | null
  }>
}

export function listClaims(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrExpenseClaim.findMany({
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

export function findClaimById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrExpenseClaim.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: claimInclude,
  })
}

export function createClaim(
  tenantId: string,
  input: ExpenseClaimCreateInput,
  totalAmount: number,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrExpenseClaim.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      claimNumber: input.claimNumber,
      title: input.title.trim(),
      travelRequestId: input.travelRequestId ?? null,
      claimDate: input.claimDate ?? new Date(),
      totalAmount,
      currencyCode: input.currencyCode ?? 'USD',
      costCenterId: input.costCenterId ?? null,
      statusCode: 'submitted',
      createdBy: actorId,
      updatedBy: actorId,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNumber: index + 1,
          expenseDate: line.expenseDate ?? null,
          category: line.category ?? 'general',
          description: line.description ?? null,
          amount: line.amount,
          taxAmount: line.taxAmount ?? 0,
          currencyCode: input.currencyCode ?? 'USD',
          receiptUrl: line.receiptUrl ?? null,
        })),
      },
    },
    include: claimInclude,
  })
}

export async function updateClaimStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  extra: Prisma.HrExpenseClaimUpdateManyMutationInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrExpenseClaim.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId, ...extra },
  })
  return result.count > 0
}

export function createReimbursement(
  tenantId: string,
  input: {
    claimId: string
    employeeId: string
    amount: string | number
    currencyCode?: string
    paymentMethod?: string
    journalEntryId?: string | null
  },
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrExpenseReimbursement.create({
    data: {
      tenantId,
      claimId: input.claimId,
      employeeId: input.employeeId,
      amount: input.amount,
      currencyCode: input.currencyCode ?? 'USD',
      paymentMethod: input.paymentMethod ?? 'bank_transfer',
      journalEntryId: input.journalEntryId ?? null,
      statusCode: 'paid',
      paidAt: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}
