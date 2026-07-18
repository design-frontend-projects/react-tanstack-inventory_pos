import { describe, expect, it } from 'vitest'
import { buildNotificationDrafts } from '#/server/notifications/notification-service'
import {
  attachmentRegisterSchema,
  customFieldDefinitionSchema,
} from '#/features/purchasing/doc-extensions-server-functions'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('buildNotificationDrafts', () => {
  const template = {
    eventType: 'approval.requested',
    title: 'Approval requested: purchase order',
    entityType: 'purchase_order',
    entityId: UUID,
  }

  it('deduplicates recipients', () => {
    const drafts = buildNotificationDrafts(['a', 'b', 'a'], null, template)

    expect(drafts.map((draft) => draft.recipientProfileId)).toEqual(['a', 'b'])
    expect(drafts[0].title).toBe(template.title)
  })

  it('never notifies the actor about their own action', () => {
    const drafts = buildNotificationDrafts(
      ['actor', 'other'],
      'actor',
      template,
    )

    expect(drafts.map((draft) => draft.recipientProfileId)).toEqual(['other'])
  })

  it('yields nothing for an empty audience', () => {
    expect(buildNotificationDrafts([], 'actor', template)).toEqual([])
  })
})

describe('attachment validation', () => {
  it('accepts attachment metadata', () => {
    expect(
      attachmentRegisterSchema.safeParse({
        entityType: 'pod_supplier_invoice',
        entityId: UUID,
        fileName: 'invoice.pdf',
        fileUrl: 'https://storage.example.com/tenant/invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 120400,
      }).success,
    ).toBe(true)
  })

  it('rejects a non-URL file reference', () => {
    expect(
      attachmentRegisterSchema.safeParse({
        entityType: 'pod_supplier_invoice',
        entityId: UUID,
        fileName: 'invoice.pdf',
        fileUrl: 'not-a-url',
      }).success,
    ).toBe(false)
  })
})

describe('custom field definition validation', () => {
  it('accepts a snake_case field key and known types', () => {
    expect(
      customFieldDefinitionSchema.safeParse({
        entityType: 'pod_supplier_invoice',
        fieldKey: 'cost_center',
        label: 'Cost Center',
        fieldType: 'select',
        optionsJson: ['HQ', 'Branch'],
        isRequired: true,
      }).success,
    ).toBe(true)
  })

  it('rejects invalid keys and unknown field types', () => {
    expect(
      customFieldDefinitionSchema.safeParse({
        entityType: 'x',
        fieldKey: 'Cost Center',
        label: 'x',
        fieldType: 'text',
      }).success,
    ).toBe(false)
    expect(
      customFieldDefinitionSchema.safeParse({
        entityType: 'x',
        fieldKey: 'ok_key',
        label: 'x',
        fieldType: 'file',
      }).success,
    ).toBe(false)
  })
})
