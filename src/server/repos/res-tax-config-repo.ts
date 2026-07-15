import { prisma } from '#/server/db/client'
import type {
  ResChargeType,
  ResTaxAppliesTo,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResTaxConfigWriteInput {
  branchId?: string | null
  taxRateId?: string | null
  code: string
  name: string
  rate: string | number
  isInclusive?: boolean
  appliesTo?: ResTaxAppliesTo
  isActive?: boolean
}

export interface ResServiceChargeRuleWriteInput {
  branchId?: string | null
  code: string
  name: string
  chargeType?: ResChargeType
  value: string | number
  minGuests?: number | null
  appliesToServiceJson?: unknown
  isTaxable?: boolean
  isActive?: boolean
}

// --- Tax configs ------------------------------------------------------------

export function findTaxConfigById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.resTaxConfig.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function listTaxConfigs(
  tenantId: string,
  options: { branchId?: string | null } = {},
  client: PrismaClientLike = prisma
) {
  return client.resTaxConfig.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(options.branchId !== undefined ? { branchId: options.branchId } : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export function createTaxConfig(
  tenantId: string,
  input: ResTaxConfigWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resTaxConfig.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      taxRateId: input.taxRateId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      rate: input.rate,
      isInclusive: input.isInclusive ?? false,
      appliesTo: input.appliesTo ?? 'LINE',
      isActive: input.isActive ?? true,
    },
  })
}

export async function softDeleteTaxConfig(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resTaxConfig.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

// --- Service charge rules ---------------------------------------------------

export function listServiceChargeRules(
  tenantId: string,
  options: { branchId?: string | null } = {},
  client: PrismaClientLike = prisma
) {
  return client.resServiceChargeRule.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(options.branchId !== undefined ? { branchId: options.branchId } : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export function createServiceChargeRule(
  tenantId: string,
  input: ResServiceChargeRuleWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.resServiceChargeRule.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      code: input.code.trim(),
      name: input.name.trim(),
      chargeType: input.chargeType ?? 'PERCENT',
      value: input.value,
      minGuests: input.minGuests ?? null,
      appliesToServiceJson: (input.appliesToServiceJson ?? undefined) as never,
      isTaxable: input.isTaxable ?? false,
      isActive: input.isActive ?? true,
    },
  })
}

export async function softDeleteServiceChargeRule(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.resServiceChargeRule.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}
