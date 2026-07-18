import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import type { CurrentUserContext } from '#/types/auth'

// Tenant-defined custom fields for purchasing documents: admins declare
// definitions per entity type; values attach per document as JSON.

export interface CustomFieldDefinitionInput {
  entityType: string
  fieldKey: string
  label: string
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select'
  optionsJson?: unknown
  isRequired?: boolean
  displayOrder?: number
}

export async function createCustomFieldDefinition(
  context: CurrentUserContext,
  tenantId: string,
  input: CustomFieldDefinitionInput,
) {
  try {
    const definition = await prisma.podCustomFieldDefinition.create({
      data: {
        tenantId,
        entityType: input.entityType,
        fieldKey: input.fieldKey,
        label: input.label,
        fieldType: input.fieldType,
        optionsJson:
          input.optionsJson === undefined
            ? Prisma.DbNull
            : (input.optionsJson as Prisma.InputJsonValue),
        isRequired: input.isRequired ?? false,
        displayOrder: input.displayOrder ?? 0,
      },
    })

    await createAuditLog({
      tenantId,
      actorProfileId: context.profileId,
      actorEmail: context.email,
      actionKey: 'purchase.config_manage',
      entityType: 'pod_custom_field_definition',
      entityId: definition.id,
      newValues: { entityType: input.entityType, fieldKey: input.fieldKey },
    })

    return definition
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictError(
        `A "${input.fieldKey}" field already exists for ${input.entityType}.`,
      )
    }
    throw error
  }
}

export function listCustomFieldDefinitions(
  _context: CurrentUserContext,
  tenantId: string,
  entityType?: string,
) {
  return prisma.podCustomFieldDefinition.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(entityType ? { entityType } : {}),
    },
    orderBy: [{ entityType: 'asc' }, { displayOrder: 'asc' }],
  })
}

export async function deleteCustomFieldDefinition(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const result = await prisma.podCustomFieldDefinition.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  if (result.count === 0) {
    throw new NotFoundError('Custom field definition not found.')
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'purchase.config_manage',
    entityType: 'pod_custom_field_definition',
    entityId: id,
    newValues: { action: 'delete' },
  })

  return { id }
}

// Upserts one document's custom-field values. Unknown keys are rejected and
// required fields must be present — the definition set is the contract.
export async function setCustomFieldValues(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    entityType: string
    entityId: string
    values: Record<string, unknown>
  },
) {
  const definitions = await prisma.podCustomFieldDefinition.findMany({
    where: {
      tenantId,
      entityType: input.entityType,
      deletedAt: null,
      isActive: true,
    },
  })
  const byKey = new Map(
    definitions.map((definition) => [definition.fieldKey, definition]),
  )

  for (const key of Object.keys(input.values)) {
    if (!byKey.has(key)) {
      throw new ConflictError(
        `Unknown custom field "${key}" for ${input.entityType}.`,
      )
    }
  }

  for (const definition of definitions) {
    if (
      definition.isRequired &&
      (input.values[definition.fieldKey] === undefined ||
        input.values[definition.fieldKey] === null ||
        input.values[definition.fieldKey] === '')
    ) {
      throw new ConflictError(
        `Custom field "${definition.fieldKey}" is required.`,
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(input.values)) {
      const definition = byKey.get(key)!

      await tx.podCustomFieldValue.upsert({
        where: {
          tenantId_definitionId_entityId: {
            tenantId,
            definitionId: definition.id,
            entityId: input.entityId,
          },
        },
        create: {
          tenantId,
          definitionId: definition.id,
          entityType: input.entityType,
          entityId: input.entityId,
          valueJson: value as Prisma.InputJsonValue,
        },
        update: { valueJson: value as Prisma.InputJsonValue },
      })
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.custom_fields_set',
        entityType: input.entityType,
        entityId: input.entityId,
        newValues: { keys: Object.keys(input.values) },
      },
      tx,
    )
  })

  return getCustomFieldValues(
    context,
    tenantId,
    input.entityType,
    input.entityId,
  )
}

export async function getCustomFieldValues(
  _context: CurrentUserContext,
  tenantId: string,
  entityType: string,
  entityId: string,
) {
  const values = await prisma.podCustomFieldValue.findMany({
    where: { tenantId, entityType, entityId },
    include: { definition: true },
  })

  return values.map((value) => ({
    definitionId: value.definitionId,
    fieldKey: value.definition.fieldKey,
    label: value.definition.label,
    fieldType: value.definition.fieldType,
    value: value.valueJson,
  }))
}
