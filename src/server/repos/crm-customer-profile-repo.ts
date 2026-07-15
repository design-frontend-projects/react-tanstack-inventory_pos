import { prisma } from '#/server/db/client'
import type {
  ConsentChannel,
  ConsentPurpose,
  ConsentStatus,
  CrmAddressType,
  CrmContactType,
  CrmLifecycleStatus,
  CrmRelationType,
  Prisma,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Satellites of the `customers` master: 1:1 profile, multi-valued contacts /
// addresses / relationships, key-value preferences, and current-state consents.
// All rows are tenant-scoped; customerId is a bare scalar (app-enforced).
// JSON columns accept the Zod-validated record shape; the cast to Prisma's
// InputJsonValue happens here, at the Prisma boundary.

export type JsonRecordInput = Record<string, unknown> | Prisma.InputJsonValue

function toJson(value: JsonRecordInput): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export interface ProfileWriteInput {
  dateOfBirth?: Date | null
  anniversaryDate?: Date | null
  gender?: string | null
  languageCode?: string | null
  currencyCode?: string | null
  timezone?: string | null
  lifecycleStatus?: CrmLifecycleStatus
  vipLevel?: number
  classification?: string | null
  isCorporate?: boolean
  companyName?: string | null
  acquisitionChannel?: string | null
  notes?: string | null
}

export function findProfileByCustomerId(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerProfile.findUnique({
    where: { tenantId_customerId: { tenantId, customerId } },
  })
}

export function upsertProfile(
  tenantId: string,
  customerId: string,
  input: ProfileWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerProfile.upsert({
    where: { tenantId_customerId: { tenantId, customerId } },
    create: { tenantId, customerId, ...input },
    update: { ...input },
  })
}

export interface ContactWriteInput {
  contactType: CrmContactType
  label?: string | null
  value: string
  isPrimary?: boolean
  isVerified?: boolean
  metaJson?: JsonRecordInput | null
}

export function listContacts(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerContact.findMany({
    where: { tenantId, customerId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
}

export function createContact(
  tenantId: string,
  customerId: string,
  input: ContactWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerContact.create({
    data: {
      tenantId,
      customerId,
      contactType: input.contactType,
      label: input.label ?? null,
      value: input.value,
      isPrimary: input.isPrimary ?? false,
      isVerified: input.isVerified ?? false,
      metaJson: input.metaJson ? toJson(input.metaJson) : undefined,
    },
  })
}

export async function updateContact(
  tenantId: string,
  id: string,
  input: Partial<ContactWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomerContact.updateMany({
    where: { id, tenantId },
    data: {
      ...(input.contactType !== undefined ? { contactType: input.contactType } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
      ...(input.metaJson != null ? { metaJson: toJson(input.metaJson) } : {}),
    },
  })

  return result.count > 0
}

export async function deleteContact(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomerContact.deleteMany({ where: { id, tenantId } })

  return result.count > 0
}

export interface AddressWriteInput {
  addressType?: CrmAddressType
  label?: string | null
  addressJson: JsonRecordInput
  deliveryInstructions?: string | null
  latitude?: Prisma.Decimal | string | number | null
  longitude?: Prisma.Decimal | string | number | null
  isDefault?: boolean
}

export function listAddresses(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerAddress.findMany({
    where: { tenantId, customerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
}

export function createAddress(
  tenantId: string,
  customerId: string,
  input: AddressWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerAddress.create({
    data: {
      tenantId,
      customerId,
      addressType: input.addressType ?? 'OTHER',
      label: input.label ?? null,
      addressJson: toJson(input.addressJson),
      deliveryInstructions: input.deliveryInstructions ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      isDefault: input.isDefault ?? false,
    },
  })
}

export async function updateAddress(
  tenantId: string,
  id: string,
  input: Partial<AddressWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomerAddress.updateMany({
    where: { id, tenantId },
    data: {
      ...(input.addressType !== undefined ? { addressType: input.addressType } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.addressJson !== undefined ? { addressJson: toJson(input.addressJson) } : {}),
      ...(input.deliveryInstructions !== undefined
        ? { deliveryInstructions: input.deliveryInstructions }
        : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  })

  return result.count > 0
}

export async function deleteAddress(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomerAddress.deleteMany({ where: { id, tenantId } })

  return result.count > 0
}

export interface RelationshipWriteInput {
  relatedCustomerId?: string | null
  relatedName?: string | null
  relationType: CrmRelationType
  phone?: string | null
  note?: string | null
}

export function listRelationships(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerRelationship.findMany({
    where: { tenantId, customerId },
    orderBy: { createdAt: 'asc' },
  })
}

export function createRelationship(
  tenantId: string,
  customerId: string,
  input: RelationshipWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerRelationship.create({
    data: {
      tenantId,
      customerId,
      relatedCustomerId: input.relatedCustomerId ?? null,
      relatedName: input.relatedName ?? null,
      relationType: input.relationType,
      phone: input.phone ?? null,
      note: input.note ?? null,
    },
  })
}

export async function deleteRelationship(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.crmCustomerRelationship.deleteMany({
    where: { id, tenantId },
  })

  return result.count > 0
}

export function listPreferences(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerPreference.findMany({
    where: { tenantId, customerId },
    orderBy: { prefKey: 'asc' },
  })
}

export function setPreference(
  tenantId: string,
  customerId: string,
  prefKey: string,
  valueJson: unknown,
  client: PrismaClientLike = prisma
) {
  const value = valueJson as Prisma.InputJsonValue

  return client.crmCustomerPreference.upsert({
    where: { tenantId_customerId_prefKey: { tenantId, customerId, prefKey } },
    create: { tenantId, customerId, prefKey, valueJson: value },
    update: { valueJson: value },
  })
}

export interface ConsentWriteInput {
  channel: ConsentChannel
  purpose: ConsentPurpose
  status: ConsentStatus
  source?: string | null
  evidenceJson?: JsonRecordInput | null
}

export function listConsents(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCommunicationConsent.findMany({
    where: { tenantId, customerId },
    orderBy: [{ channel: 'asc' }, { purpose: 'asc' }],
  })
}

export function upsertConsent(
  tenantId: string,
  customerId: string,
  input: ConsentWriteInput,
  client: PrismaClientLike = prisma
) {
  const now = new Date()
  const stampGranted = input.status === 'GRANTED' ? { grantedAt: now } : {}
  const stampWithdrawn = input.status === 'WITHDRAWN' ? { withdrawnAt: now } : {}

  return client.crmCommunicationConsent.upsert({
    where: {
      tenantId_customerId_channel_purpose: {
        tenantId,
        customerId,
        channel: input.channel,
        purpose: input.purpose,
      },
    },
    create: {
      tenantId,
      customerId,
      channel: input.channel,
      purpose: input.purpose,
      status: input.status,
      source: input.source ?? null,
      evidenceJson: input.evidenceJson ? toJson(input.evidenceJson) : undefined,
      ...stampGranted,
      ...stampWithdrawn,
    },
    update: {
      status: input.status,
      source: input.source ?? null,
      evidenceJson: input.evidenceJson ? toJson(input.evidenceJson) : undefined,
      ...stampGranted,
      ...stampWithdrawn,
    },
  })
}
