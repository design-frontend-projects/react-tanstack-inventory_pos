import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as attachmentService from '#/server/purchasing/attachment-service'
import * as customFieldService from '#/server/purchasing/custom-field-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'

// Cross-cutting document extensions: attachment metadata + custom fields.
// Reads are open to any purchasing viewer; writes to any purchasing editor
// (any-of semantics); definition management is config-only.

const VIEW_ANY = [
  'purchase.po_view',
  'purchase.invoice_view',
  'purchase.rfq_view',
  'purchase.quotation_view',
  'purchase.payment_view',
  'purchase.requisition_view',
]

const MANAGE_ANY = [
  'purchase.po_create',
  'purchase.invoice_manage',
  'purchase.rfq_manage',
  'purchase.quotation_manage',
  'purchase.payment_manage',
  'purchase.landed_cost_manage',
  'purchase.requisition_manage',
]

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})

const entityRefSchema = z.object({
  entityType: z.string().min(1).max(60),
  entityId: z.string().uuid(),
})

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

// --- Attachments --------------------------------------------------------------

export const attachmentRegisterSchema = entityRefSchema.extend({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url().max(2000),
  mimeType: z.string().max(120).nullish(),
  fileSize: z.number().int().min(0).nullish(),
  category: z.string().max(60).nullish(),
})

export const registerAttachmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: attachmentRegisterSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE_ANY)

    return attachmentService.registerAttachment(
      context,
      data.tenantId,
      data.input,
    )
  })

export const listAttachmentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: entityRefSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW_ANY)

    return attachmentService.listAttachments(
      context,
      data.tenantId,
      data.input.entityType,
      data.input.entityId,
    )
  })

export const deleteAttachmentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE_ANY)

    return attachmentService.deleteAttachment(context, data.tenantId, data.id)
  })

// --- Custom fields ------------------------------------------------------------

export const customFieldDefinitionSchema = z.object({
  entityType: z.string().min(1).max(60),
  fieldKey: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(120),
  fieldType: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  optionsJson: z.unknown().optional(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export const createCustomFieldDefinitionServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: customFieldDefinitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return customFieldService.createCustomFieldDefinition(
      context,
      data.tenantId,
      data.input,
    )
  })

export const listCustomFieldDefinitionsServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ entityType: z.string().max(60).optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW_ANY)

    return customFieldService.listCustomFieldDefinitions(
      context,
      data.tenantId,
      data.entityType,
    )
  })

export const deleteCustomFieldDefinitionServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return customFieldService.deleteCustomFieldDefinition(
      context,
      data.tenantId,
      data.id,
    )
  })

export const setCustomFieldValuesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      input: entityRefSchema.extend({
        values: z.record(z.string(), z.unknown()),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE_ANY)

    return customFieldService.setCustomFieldValues(
      context,
      data.tenantId,
      data.input,
    )
  })

export const getCustomFieldValuesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: entityRefSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW_ANY)

    return customFieldService.getCustomFieldValues(
      context,
      data.tenantId,
      data.input.entityType,
      data.input.entityId,
    )
  })
