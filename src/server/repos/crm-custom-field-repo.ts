import { prisma } from '#/server/db/client'
import type { CrmFieldType, Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-defined custom fields (definitions) and their per-customer values.

export interface CustomFieldDefinitionWriteInput {
  entityType?: string
  fieldKey: string
  label: string
  fieldType: CrmFieldType
  optionsJson?: Record<string, unknown> | Prisma.InputJsonValue | null
  isRequired?: boolean
  displayOrder?: number
}

export function listDefinitions(
  tenantId: string,
  entityType = 'customer',
  client: PrismaClientLike = prisma
) {
  return client.crmCustomFieldDefinition.findMany({
    where: { tenantId, entityType, deletedAt: null },
    orderBy: { displayOrder: 'asc' },
  })
}

export function upsertDefinition(
  tenantId: string,
  input: CustomFieldDefinitionWriteInput,
  client: PrismaClientLike = prisma
) {
  const entityType = input.entityType ?? 'customer'

  return client.crmCustomFieldDefinition.upsert({
    where: {
      tenantId_entityType_fieldKey: { tenantId, entityType, fieldKey: input.fieldKey },
    },
    create: {
      tenantId,
      entityType,
      fieldKey: input.fieldKey,
      label: input.label,
      fieldType: input.fieldType,
      optionsJson:
        input.optionsJson == null ? undefined : (input.optionsJson as Prisma.InputJsonValue),
      isRequired: input.isRequired ?? false,
      displayOrder: input.displayOrder ?? 0,
    },
    update: {
      label: input.label,
      fieldType: input.fieldType,
      optionsJson:
        input.optionsJson == null ? undefined : (input.optionsJson as Prisma.InputJsonValue),
      isRequired: input.isRequired ?? false,
      displayOrder: input.displayOrder ?? 0,
      deletedAt: null,
    },
  })
}

export async function softDeleteDefinition(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomFieldDefinition.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  return result.count > 0
}

export function listValuesForCustomer(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomFieldValue.findMany({
    where: { tenantId, customerId, definition: { deletedAt: null } },
    include: { definition: true },
  })
}

export function setValue(
  tenantId: string,
  definitionId: string,
  customerId: string,
  valueJson: unknown,
  client: PrismaClientLike = prisma
) {
  const value = valueJson as Prisma.InputJsonValue

  return client.crmCustomFieldValue.upsert({
    where: {
      tenantId_definitionId_customerId: { tenantId, definitionId, customerId },
    },
    create: { tenantId, definitionId, customerId, valueJson: value },
    update: { valueJson: value },
  })
}
