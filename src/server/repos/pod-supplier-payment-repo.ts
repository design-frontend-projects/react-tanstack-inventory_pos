import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierPaymentCreateInput {
  documentNumber: string
  supplierId: string
  paymentMethodId?: string | null
  paymentDate?: Date | null
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | string | number | null
  amount: Prisma.Decimal | string | number
  referenceNumber?: string | null
  bankAccountId?: string | null
  isAdvance?: boolean
  notes?: string | null
  createdBy?: string | null
}

export interface PaymentAllocationRowInput {
  supplierInvoiceId?: string | null
  financialNoteId?: string | null
  allocatedAmount: Prisma.Decimal | string | number
}

const paymentInclude = {
  allocations: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PodSupplierPaymentInclude

export type SupplierPaymentWithAllocations =
  Prisma.PodSupplierPaymentGetPayload<{
    include: typeof paymentInclude
  }>

export function findPaymentById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<SupplierPaymentWithAllocations | null> {
  return client.podSupplierPayment.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: paymentInclude,
  })
}

export function listPayments(
  tenantId: string,
  options: {
    statusCode?: string
    supplierId?: string
    isAdvance?: boolean
    take?: number
  } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierPayment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options.supplierId ? { supplierId: options.supplierId } : {}),
      ...(options.isAdvance !== undefined
        ? { isAdvance: options.isAdvance }
        : {}),
    },
    include: paymentInclude,
    orderBy: { createdAt: 'desc' },
    take: options.take ?? 100,
  })
}

export function createPayment(
  tenantId: string,
  input: SupplierPaymentCreateInput,
  client: PrismaClientLike = prisma,
): Promise<SupplierPaymentWithAllocations> {
  return client.podSupplierPayment.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      supplierId: input.supplierId,
      paymentMethodId: input.paymentMethodId ?? null,
      ...(input.paymentDate ? { paymentDate: input.paymentDate } : {}),
      currencyCode: input.currencyCode ?? 'USD',
      exchangeRate: input.exchangeRate ?? 1,
      amount: input.amount,
      unallocatedAmount: input.amount,
      referenceNumber: input.referenceNumber ?? null,
      bankAccountId: input.bankAccountId ?? null,
      isAdvance: input.isAdvance ?? false,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    },
    include: paymentInclude,
  })
}

// Allocations are edited as a set while the payment is unposted; posting
// freezes them and applies each row to its invoice.
export async function replaceAllocations(
  tenantId: string,
  paymentId: string,
  rows: Array<PaymentAllocationRowInput>,
  totals: {
    allocatedAmount: Prisma.Decimal | string | number
    unallocatedAmount: Prisma.Decimal | string | number
  },
  updatedBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  await client.podSupplierPaymentAllocation.deleteMany({
    where: { tenantId, paymentId },
  })

  if (rows.length > 0) {
    await client.podSupplierPaymentAllocation.createMany({
      data: rows.map((row) => ({
        tenantId,
        paymentId,
        supplierInvoiceId: row.supplierInvoiceId ?? null,
        financialNoteId: row.financialNoteId ?? null,
        allocatedAmount: row.allocatedAmount,
      })),
    })
  }

  await client.podSupplierPayment.updateMany({
    where: { id: paymentId, tenantId, deletedAt: null },
    data: {
      allocatedAmount: totals.allocatedAmount,
      unallocatedAmount: totals.unallocatedAmount,
      updatedBy,
    },
  })
}

export async function updatePaymentStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  updatedBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierPayment.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy },
  })

  return result.count > 0
}

export async function markPaymentPosted(
  tenantId: string,
  id: string,
  postedByProfileId: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierPayment.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode: 'posted',
      isPosted: true,
      postedAt: new Date(),
      postedByProfileId,
      updatedBy: postedByProfileId,
    },
  })

  return result.count > 0
}
