import { NotFoundError } from '#/server/auth/errors'
import {
  serializeAddress,
  serializeConsent,
  serializeContact,
  serializeCustomFieldDefinition,
  serializeCustomFieldValue,
  serializeCustomerTag,
  serializeGroup,
  serializeGroupMembership,
  serializePreference,
  serializeProfile,
  serializeRelationship,
  serializeTag,
} from '#/server/crm/crm-dto'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { serializeCustomer } from '#/server/inventory/catalog-dto'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as customFieldRepo from '#/server/repos/crm-custom-field-repo'
import * as customerRepo from '#/server/repos/customer-repo'
import * as profileRepo from '#/server/repos/crm-customer-profile-repo'
import * as tagRepo from '#/server/repos/crm-tag-repo'
import type { CurrentUserContext } from '#/types/auth'

// Customer Management context: master-data satellites of `customers`. Reads
// aggregate the 360 view from projections; writes are transactional and emit
// audit-log rows (and domain events where CRM itself is the source module,
// e.g. consent changes).

async function requireCustomer(tenantId: string, customerId: string) {
  const customer = await customerRepo.findCustomerById(tenantId, customerId)

  if (!customer) {
    throw new NotFoundError('Customer not found.')
  }

  return customer
}

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string | null,
  newValues?: Record<string, unknown> | null
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: newValues ?? null,
  })
}

// The 360 read: master + satellites in one shot. Later phases extend this with
// metrics, loyalty, segments, and recent timeline (all projection reads).
export async function getCustomer360(
  _context: CurrentUserContext,
  tenantId: string,
  customerId: string
) {
  const customer = await requireCustomer(tenantId, customerId)

  const [
    profile,
    contacts,
    addresses,
    relationships,
    preferences,
    consents,
    tags,
    groupMemberships,
    customFieldValues,
  ] = await Promise.all([
    profileRepo.findProfileByCustomerId(tenantId, customerId),
    profileRepo.listContacts(tenantId, customerId),
    profileRepo.listAddresses(tenantId, customerId),
    profileRepo.listRelationships(tenantId, customerId),
    profileRepo.listPreferences(tenantId, customerId),
    profileRepo.listConsents(tenantId, customerId),
    tagRepo.listCustomerTags(tenantId, customerId),
    tagRepo.listCustomerGroupMemberships(tenantId, customerId),
    customFieldRepo.listValuesForCustomer(tenantId, customerId),
  ])

  return {
    customer: serializeCustomer(customer),
    profile: profile ? serializeProfile(profile) : null,
    contacts: contacts.map(serializeContact),
    addresses: addresses.map(serializeAddress),
    relationships: relationships.map(serializeRelationship),
    preferences: preferences.map(serializePreference),
    consents: consents.map(serializeConsent),
    tags: tags.map(serializeCustomerTag),
    groups: groupMemberships.map(serializeGroupMembership),
    customFields: customFieldValues.map(serializeCustomFieldValue),
  }
}

export async function upsertProfile(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  input: profileRepo.ProfileWriteInput
) {
  await requireCustomer(tenantId, customerId)

  const profile = await profileRepo.upsertProfile(tenantId, customerId, input)
  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_profile', profile.id, {
    customerId,
  })

  return serializeProfile(profile)
}

export async function upsertContact(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  input: profileRepo.ContactWriteInput & { id?: string }
) {
  await requireCustomer(tenantId, customerId)

  if (input.id) {
    const updated = await profileRepo.updateContact(tenantId, input.id, input)

    if (!updated) {
      throw new NotFoundError('Contact not found.')
    }

    await audit(context, tenantId, 'crm.profile_update', 'crm_customer_contact', input.id, null)

    return { id: input.id }
  }

  const contact = await profileRepo.createContact(tenantId, customerId, input)
  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_contact', contact.id, null)

  return serializeContact(contact)
}

export async function deleteContact(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const deleted = await profileRepo.deleteContact(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Contact not found.')
  }

  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_contact', id, null)

  return { id, deleted: true }
}

export async function upsertAddress(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  input: profileRepo.AddressWriteInput & { id?: string }
) {
  await requireCustomer(tenantId, customerId)

  if (input.id) {
    const updated = await profileRepo.updateAddress(tenantId, input.id, input)

    if (!updated) {
      throw new NotFoundError('Address not found.')
    }

    await audit(context, tenantId, 'crm.profile_update', 'crm_customer_address', input.id, null)

    return { id: input.id }
  }

  const address = await profileRepo.createAddress(tenantId, customerId, input)
  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_address', address.id, null)

  return serializeAddress(address)
}

export async function deleteAddress(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const deleted = await profileRepo.deleteAddress(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Address not found.')
  }

  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_address', id, null)

  return { id, deleted: true }
}

export async function upsertRelationship(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  input: profileRepo.RelationshipWriteInput
) {
  await requireCustomer(tenantId, customerId)

  const relationship = await profileRepo.createRelationship(tenantId, customerId, input)
  await audit(
    context,
    tenantId,
    'crm.profile_update',
    'crm_customer_relationship',
    relationship.id,
    null
  )

  return serializeRelationship(relationship)
}

export async function deleteRelationship(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const deleted = await profileRepo.deleteRelationship(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Relationship not found.')
  }

  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_relationship', id, null)

  return { id, deleted: true }
}

export async function setPreference(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  prefKey: string,
  valueJson: unknown
) {
  await requireCustomer(tenantId, customerId)

  const preference = await profileRepo.setPreference(tenantId, customerId, prefKey, valueJson)
  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_preference', preference.id, {
    prefKey,
  })

  return serializePreference(preference)
}

// Consent changes are auditable events: the current-state row is upserted and
// a crm.consent_changed domain event is appended in the same transaction (the
// timeline is the consent history).
export async function setConsent(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  input: profileRepo.ConsentWriteInput
) {
  await requireCustomer(tenantId, customerId)

  const consent = await prisma.$transaction(async (tx) => {
    const upserted = await profileRepo.upsertConsent(tenantId, customerId, input, tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'crm.consent_change',
        entityType: 'crm_communication_consent',
        entityId: upserted.id,
        newValues: {
          channel: input.channel,
          purpose: input.purpose,
          status: input.status,
        },
      },
      tx
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'crm.consent_changed',
      aggregateType: 'crm_communication_consent',
      aggregateId: upserted.id,
      customerId,
      payload: {
        channel: input.channel,
        purpose: input.purpose,
        status: input.status,
        source: input.source ?? null,
      },
      actorProfileId: context.profileId,
    })

    return upserted
  })

  return serializeConsent(consent)
}

export async function listConsents(
  _context: CurrentUserContext,
  tenantId: string,
  customerId: string
) {
  const consents = await profileRepo.listConsents(tenantId, customerId)

  return consents.map(serializeConsent)
}

// --- Tags / groups / custom fields -------------------------------------------

export async function listTags(_context: CurrentUserContext, tenantId: string) {
  const tags = await tagRepo.listTags(tenantId)

  return tags.map(serializeTag)
}

export async function upsertTag(
  context: CurrentUserContext,
  tenantId: string,
  input: { id?: string; name: string; color?: string | null }
) {
  if (input.id) {
    const updated = await tagRepo.updateTag(tenantId, input.id, input)

    if (!updated) {
      throw new NotFoundError('Tag not found.')
    }

    await audit(context, tenantId, 'crm.settings_update', 'crm_tag', input.id, null)

    return { id: input.id }
  }

  const tag = await tagRepo.createTag(tenantId, input)
  await audit(context, tenantId, 'crm.settings_update', 'crm_tag', tag.id, { name: tag.name })

  return serializeTag(tag)
}

export async function assignTag(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  tagId: string
) {
  await requireCustomer(tenantId, customerId)
  await tagRepo.assignTag(tenantId, customerId, tagId)
  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_tag', tagId, { customerId })

  return { customerId, tagId, assigned: true }
}

export async function unassignTag(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  tagId: string
) {
  const removed = await tagRepo.unassignTag(tenantId, customerId, tagId)

  if (!removed) {
    throw new NotFoundError('Tag assignment not found.')
  }

  await audit(context, tenantId, 'crm.profile_update', 'crm_customer_tag', tagId, { customerId })

  return { customerId, tagId, assigned: false }
}

export async function listGroups(_context: CurrentUserContext, tenantId: string) {
  const groups = await tagRepo.listGroups(tenantId)

  return groups.map((group) => ({ ...serializeGroup(group), memberCount: group._count.members }))
}

export async function upsertGroup(
  context: CurrentUserContext,
  tenantId: string,
  input: { id?: string; code: string; name: string; description?: string | null }
) {
  if (input.id) {
    const updated = await tagRepo.updateGroup(tenantId, input.id, input)

    if (!updated) {
      throw new NotFoundError('Group not found.')
    }

    await audit(context, tenantId, 'crm.settings_update', 'crm_customer_group', input.id, null)

    return { id: input.id }
  }

  const group = await tagRepo.createGroup(tenantId, input)
  await audit(context, tenantId, 'crm.settings_update', 'crm_customer_group', group.id, {
    code: group.code,
  })

  return serializeGroup(group)
}

export async function setGroupMembers(
  context: CurrentUserContext,
  tenantId: string,
  groupId: string,
  customerIds: Array<string>
) {
  const count = await prisma.$transaction((tx) =>
    tagRepo.setGroupMembers(tenantId, groupId, customerIds, tx)
  )

  await audit(context, tenantId, 'crm.settings_update', 'crm_customer_group', groupId, {
    memberCount: count,
  })

  return { groupId, memberCount: count }
}

export async function listCustomFieldDefinitions(
  _context: CurrentUserContext,
  tenantId: string,
  entityType = 'customer'
) {
  const definitions = await customFieldRepo.listDefinitions(tenantId, entityType)

  return definitions.map(serializeCustomFieldDefinition)
}

export async function upsertCustomFieldDefinition(
  context: CurrentUserContext,
  tenantId: string,
  input: customFieldRepo.CustomFieldDefinitionWriteInput
) {
  const definition = await customFieldRepo.upsertDefinition(tenantId, input)
  await audit(
    context,
    tenantId,
    'crm.settings_update',
    'crm_custom_field_definition',
    definition.id,
    { fieldKey: definition.fieldKey }
  )

  return serializeCustomFieldDefinition(definition)
}

export async function setCustomFieldValues(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  values: Array<{ definitionId: string; valueJson: unknown }>
) {
  await requireCustomer(tenantId, customerId)

  await prisma.$transaction(async (tx) => {
    for (const value of values) {
      await customFieldRepo.setValue(
        tenantId,
        value.definitionId,
        customerId,
        value.valueJson,
        tx
      )
    }
  })

  await audit(context, tenantId, 'crm.profile_update', 'crm_custom_field_value', customerId, {
    count: values.length,
  })

  const refreshed = await customFieldRepo.listValuesForCustomer(tenantId, customerId)

  return refreshed.map(serializeCustomFieldValue)
}
