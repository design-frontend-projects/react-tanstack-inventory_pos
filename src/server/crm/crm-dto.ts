import type {
  CrmCustomerAddress,
  CrmCustomerContact,
  CrmCustomerGroup,
  CrmCustomerGroupMember,
  CrmCustomerPreference,
  CrmCustomerProfile,
  CrmCustomerRelationship,
  CrmCommunicationConsent,
  CrmCustomerTag,
  CrmCustomFieldDefinition,
  CrmCustomFieldValue,
  CrmTag,
} from '#/server/db/generated/prisma/client'

// RPC-boundary serializers: Prisma Decimal columns become strings so payloads
// survive JSON transport without precision loss (same convention as
// sales-dto.ts / inventory-dto.ts).

export function serializeProfile(profile: CrmCustomerProfile) {
  return { ...profile }
}

export function serializeContact(contact: CrmCustomerContact) {
  return { ...contact }
}

export function serializeAddress(address: CrmCustomerAddress) {
  return {
    ...address,
    latitude: address.latitude?.toString() ?? null,
    longitude: address.longitude?.toString() ?? null,
  }
}

export function serializeRelationship(relationship: CrmCustomerRelationship) {
  return { ...relationship }
}

export function serializeConsent(consent: CrmCommunicationConsent) {
  return { ...consent }
}

export function serializePreference(preference: CrmCustomerPreference) {
  return { ...preference }
}

export function serializeTag(tag: CrmTag) {
  return { ...tag }
}

export function serializeCustomerTag(link: CrmCustomerTag & { tag: CrmTag }) {
  return { ...link, tag: serializeTag(link.tag) }
}

export function serializeGroup(group: CrmCustomerGroup) {
  return { ...group }
}

export function serializeGroupMembership(
  member: CrmCustomerGroupMember & { group: CrmCustomerGroup }
) {
  return { ...member, group: serializeGroup(member.group) }
}

export function serializeCustomFieldDefinition(definition: CrmCustomFieldDefinition) {
  return { ...definition }
}

export function serializeCustomFieldValue(
  value: CrmCustomFieldValue & { definition: CrmCustomFieldDefinition }
) {
  return { ...value, definition: serializeCustomFieldDefinition(value.definition) }
}
