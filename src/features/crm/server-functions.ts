import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as loyaltyService from '#/server/crm/loyalty-service'
import * as metricsService from '#/server/crm/metrics-service'
import * as profileService from '#/server/crm/customer-profile-service'
import * as segmentService from '#/server/crm/segment-service'
import * as timelineService from '#/server/crm/timeline-service'
import { runCrmProjector } from '#/server/crm/projector'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  addressUpsertSchema,
  adjustPointsSchema,
  consentSetSchema,
  contactUpsertSchema,
  customFieldDefinitionSchema,
  customFieldValuesSchema,
  earnRuleSchema,
  groupUpsertSchema,
  loyaltySettingsSchema,
  loyaltyTierSchema,
  preferenceSetSchema,
  profileUpsertSchema,
  redeemPointsSchema,
  relationshipUpsertSchema,
  segmentUpsertSchema,
  tagUpsertSchema,
} from '#/features/crm/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId
    ),
    permission
  )
}

const base = z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema })
const withId = base.extend({ id: idSchema })
const withCustomer = base.extend({ customerId: idSchema })

// --- Customer 360 & profile ---------------------------------------------------

export const getCustomer360ServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.view')

    return profileService.getCustomer360(context, data.tenantId, data.customerId)
  })

export const upsertCustomerProfileServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: profileUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.upsertProfile(context, data.tenantId, data.customerId, data.input)
  })

export const upsertCustomerContactServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: contactUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.upsertContact(context, data.tenantId, data.customerId, data.input)
  })

export const deleteCustomerContactServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.deleteContact(context, data.tenantId, data.id)
  })

export const upsertCustomerAddressServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: addressUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.upsertAddress(context, data.tenantId, data.customerId, data.input)
  })

export const deleteCustomerAddressServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.deleteAddress(context, data.tenantId, data.id)
  })

export const upsertCustomerRelationshipServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: relationshipUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.upsertRelationship(
      context,
      data.tenantId,
      data.customerId,
      data.input
    )
  })

export const deleteCustomerRelationshipServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.deleteRelationship(context, data.tenantId, data.id)
  })

export const setCustomerPreferenceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: preferenceSetSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.setPreference(
      context,
      data.tenantId,
      data.customerId,
      data.input.prefKey,
      data.input.valueJson
    )
  })

export const setConsentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: consentSetSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.setConsent(context, data.tenantId, data.customerId, data.input)
  })

export const listConsentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.view')

    return profileService.listConsents(context, data.tenantId, data.customerId)
  })

// --- Tags / groups / custom fields --------------------------------------------

export const listTagsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.view')

    return profileService.listTags(context, data.tenantId)
  })

export const upsertTagServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: tagUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.settings_manage')

    return profileService.upsertTag(context, data.tenantId, data.input)
  })

export const assignTagServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ tagId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.assignTag(context, data.tenantId, data.customerId, data.tagId)
  })

export const unassignTagServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ tagId: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.unassignTag(context, data.tenantId, data.customerId, data.tagId)
  })

export const listGroupsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.view')

    return profileService.listGroups(context, data.tenantId)
  })

export const upsertGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: groupUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.settings_manage')

    return profileService.upsertGroup(context, data.tenantId, data.input)
  })

export const setGroupMembersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ groupId: idSchema, customerIds: z.array(idSchema).max(10_000) }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.settings_manage')

    return profileService.setGroupMembers(
      context,
      data.tenantId,
      data.groupId,
      data.customerIds
    )
  })

export const listCustomFieldDefinitionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ entityType: z.string().max(60).optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.view')

    return profileService.listCustomFieldDefinitions(context, data.tenantId, data.entityType)
  })

export const upsertCustomFieldDefinitionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: customFieldDefinitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.settings_manage')

    return profileService.upsertCustomFieldDefinition(context, data.tenantId, data.input)
  })

export const setCustomFieldValuesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ values: customFieldValuesSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.profile_manage')

    return profileService.setCustomFieldValues(
      context,
      data.tenantId,
      data.customerId,
      data.values
    )
  })

// --- Timeline -------------------------------------------------------------------

export const listCustomerTimelineServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    withCustomer.extend({
      entryType: z.string().max(40).optional(),
      before: z.coerce.date().optional(),
      take: z.number().int().min(1).max(200).optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.timeline_view')

    return timelineService.listCustomerTimeline(context, data.tenantId, data.customerId, {
      entryType: data.entryType,
      before: data.before,
      take: data.take,
    })
  })

export const addTimelineNoteServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ note: z.string().min(1).max(4000) }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.timeline_note')

    return timelineService.addManualNote(context, data.tenantId, data.customerId, data.note)
  })

// --- Loyalty ---------------------------------------------------------------------

export const getLoyaltyAccountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_view')

    return loyaltyService.getLoyaltyAccount(context, data.tenantId, data.customerId)
  })

export const listLoyaltyLedgerServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    withCustomer.extend({
      take: z.number().int().min(1).max(200).optional(),
      before: z.coerce.date().optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_view')

    return loyaltyService.listLoyaltyLedger(context, data.tenantId, data.customerId, {
      take: data.take,
      before: data.before,
    })
  })

export const redeemPointsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: redeemPointsSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_redeem')

    return loyaltyService.redeemPoints(
      context,
      data.tenantId,
      data.customerId,
      data.input.points,
      data.input
    )
  })

export const adjustPointsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer.extend({ input: adjustPointsSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_adjust')

    return loyaltyService.adjustPoints(
      context,
      data.tenantId,
      data.customerId,
      data.input.points,
      data.input.note
    )
  })

export const getLoyaltySettingsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_view')

    return loyaltyService.getLoyaltySettings(context, data.tenantId)
  })

export const updateLoyaltySettingsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: loyaltySettingsSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_manage')

    return loyaltyService.updateLoyaltySettings(context, data.tenantId, data.input)
  })

export const listLoyaltyTiersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_view')

    return loyaltyService.listLoyaltyTiers(context, data.tenantId)
  })

export const upsertLoyaltyTierServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: loyaltyTierSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_manage')

    return loyaltyService.upsertLoyaltyTier(context, data.tenantId, data.input)
  })

export const listEarnRulesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_view')

    return loyaltyService.listEarnRules(context, data.tenantId)
  })

export const upsertEarnRuleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: earnRuleSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_manage')

    return loyaltyService.upsertEarnRule(context, data.tenantId, data.input)
  })

// Scheduler-driven, like expireReservationsServerFn.
export const expireLoyaltyPointsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ limit: z.number().int().min(1).max(500).optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.loyalty_adjust')

    return loyaltyService.expireLoyaltyPoints(context, data.tenantId, { limit: data.limit })
  })

// --- Segmentation ----------------------------------------------------------------

export const listSegmentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.segment_view')

    return segmentService.listSegments(context, data.tenantId)
  })

export const upsertSegmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: segmentUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.segment_manage')

    return segmentService.upsertSegment(context, data.tenantId, data.input)
  })

export const deleteSegmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.segment_manage')

    return segmentService.deleteSegment(context, data.tenantId, data.id)
  })

export const rebuildSegmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.segment_manage')

    return segmentService.rebuildSegment(context, data.tenantId, data.id)
  })

export const listSegmentMembersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ segmentId: idSchema, take: z.number().int().min(1).max(500).optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.segment_view')

    return segmentService.listSegmentMembers(context, data.tenantId, data.segmentId, data.take)
  })

// --- Analytics -------------------------------------------------------------------

export const getCustomerMetricsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withCustomer)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.analytics_view')

    return metricsService.getCustomerMetrics(context, data.tenantId, data.customerId)
  })

export const getCrmDashboardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ churnThreshold: z.number().min(0).max(1).optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.analytics_view')

    return metricsService.getCrmDashboard(context, data.tenantId, {
      churnThreshold: data.churnThreshold,
    })
  })

// --- Ops --------------------------------------------------------------------------

// Scheduler-driven (cron / external pinger), mirroring expireReservationsServerFn.
export const runCrmProjectorServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      batchSize: z.number().int().min(1).max(1000).optional(),
      maxBatches: z.number().int().min(1).max(100).optional(),
    })
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'crm.settings_manage')

    return runCrmProjector(context, {
      batchSize: data.batchSize,
      maxBatches: data.maxBatches,
    })
  })
