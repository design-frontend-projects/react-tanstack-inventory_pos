'use client'

import * as React from 'react'
import { Button } from '#/components/ui/button'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { Input } from '#/components/ui/input'
import { StatusChip } from '#/components/board/status-chip'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { useCustomer360Mutations } from '#/features/crm/use-customer-360'
import type { Customer360 } from '#/features/crm/use-customer-360'
import { useCrmTags } from '#/features/crm/use-crm-customers'
import { errorMessage, formatDate } from '#/features/crm/crm-format'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

// Overview tab of the customer 360: contact points, addresses, relationships,
// consents, tags, preferences, and custom fields — the master-data satellites.

const CONTACT_TYPES = ['PHONE', 'EMAIL', 'SOCIAL', 'OTHER'] as const
const ADDRESS_TYPES = ['BILLING', 'SHIPPING', 'DELIVERY', 'OTHER'] as const
const RELATION_TYPES = [
  'FAMILY',
  'EMERGENCY',
  'COMPANY_CONTACT',
  'REFERRER',
  'OTHER',
] as const
const CONSENT_CHANNELS = ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'PHONE'] as const
const CONSENT_PURPOSES = ['MARKETING', 'TRANSACTIONAL', 'SURVEY'] as const
const CONSENT_STATUSES = ['GRANTED', 'DENIED', 'WITHDRAWN'] as const

function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function CustomerOverviewTab({
  customerId,
  data,
  canManage,
}: {
  customerId: string
  data: Customer360
  canManage: boolean
}) {
  const mutations = useCustomer360Mutations(customerId)
  const tagsQuery = useCrmTags()

  const [contactDrawer, setContactDrawer] = React.useState(false)
  const [contactForm, setContactForm] = React.useState({
    contactType: 'PHONE' as (typeof CONTACT_TYPES)[number],
    label: '',
    value: '',
    isPrimary: false,
  })
  const [addressDrawer, setAddressDrawer] = React.useState(false)
  const [addressForm, setAddressForm] = React.useState({
    addressType: 'DELIVERY' as (typeof ADDRESS_TYPES)[number],
    label: '',
    line1: '',
    city: '',
    notes: '',
    isDefault: false,
  })
  const [relationshipDrawer, setRelationshipDrawer] = React.useState(false)
  const [relationshipForm, setRelationshipForm] = React.useState({
    relationType: 'FAMILY' as (typeof RELATION_TYPES)[number],
    relatedName: '',
    phone: '',
    note: '',
  })
  const [pendingDelete, setPendingDelete] = React.useState<{
    kind: 'contact' | 'address' | 'relationship'
    id: string
    label: string
  } | null>(null)
  const [tagToAssign, setTagToAssign] = React.useState('')

  const consentByKey = new Map(
    data.consents.map((consent) => [
      `${consent.channel}:${consent.purpose}`,
      consent,
    ]),
  )

  const assignedTagIds = new Set(data.tags.map((link) => link.tag.id))
  const availableTags = (tagsQuery.data ?? []).filter(
    (tag) => !assignedTagIds.has(tag.id),
  )

  async function submit(action: Promise<unknown>, successTitle: string) {
    try {
      await action
      notifySuccess(successTitle)
    } catch (error: unknown) {
      notifyError(errorMessage(error))
      throw error
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard
        title="Contact points"
        action={
          canManage ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setContactDrawer(true)}
            >
              Add contact
            </Button>
          ) : undefined
        }
      >
        {data.contacts.length === 0 ? (
          <WorkspaceEmptyState
            title="No contact points"
            description="Phones, emails, and social handles appear here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{contact.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {contact.contactType.toLowerCase()}
                    {contact.label ? ` · ${contact.label}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {contact.isPrimary ? (
                    <StatusChip tone="primary">Primary</StatusChip>
                  ) : null}
                  {canManage ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setPendingDelete({
                          kind: 'contact',
                          id: contact.id,
                          label: contact.value,
                        })
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Addresses"
        action={
          canManage ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setAddressDrawer(true)}
            >
              Add address
            </Button>
          ) : undefined
        }
      >
        {data.addresses.length === 0 ? (
          <WorkspaceEmptyState
            title="No addresses"
            description="Billing, shipping, and delivery addresses appear here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.addresses.map((address) => {
              const parts = address.addressJson as Record<string, unknown>
              const line = [parts.line1, parts.city]
                .filter((part) => typeof part === 'string' && part)
                .join(', ')
              return (
                <li
                  key={address.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {line || address.label || 'Address'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {address.addressType.toLowerCase()}
                      {address.deliveryInstructions
                        ? ` · ${address.deliveryInstructions}`
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {address.isDefault ? (
                      <StatusChip tone="primary">Default</StatusChip>
                    ) : null}
                    {canManage ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          setPendingDelete({
                            kind: 'address',
                            id: address.id,
                            label: line || 'this address',
                          })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Relationships"
        action={
          canManage ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setRelationshipDrawer(true)}
            >
              Add relationship
            </Button>
          ) : undefined
        }
      >
        {data.relationships.length === 0 ? (
          <WorkspaceEmptyState
            title="No relationships"
            description="Family, emergency, and company contacts appear here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.relationships.map((relationship) => (
              <li
                key={relationship.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {relationship.relatedName ?? 'Linked customer'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relationship.relationType.toLowerCase().replace(/_/g, ' ')}
                    {relationship.phone ? ` · ${relationship.phone}` : ''}
                  </span>
                </div>
                {canManage ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      setPendingDelete({
                        kind: 'relationship',
                        id: relationship.id,
                        label: relationship.relatedName ?? 'this relationship',
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Tags">
        <div className="flex flex-wrap items-center gap-2">
          {data.tags.length === 0 ? (
            <span className="text-sm text-muted-foreground">No tags yet.</span>
          ) : (
            data.tags.map((link) => (
              <span
                key={link.tag.id}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium"
                style={
                  link.tag.color
                    ? { borderColor: link.tag.color, color: link.tag.color }
                    : undefined
                }
              >
                {link.tag.name}
                {canManage ? (
                  <button
                    type="button"
                    aria-label={`Remove tag ${link.tag.name}`}
                    className="ms-0.5 opacity-60 hover:opacity-100"
                    onClick={() =>
                      void submit(
                        mutations.unassignTag.mutateAsync(link.tag.id),
                        'Tag removed',
                      )
                    }
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))
          )}
        </div>
        {canManage && availableTags.length > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            <select
              aria-label="Tag to assign"
              className={fieldInputClassName}
              value={tagToAssign}
              onChange={(event) => setTagToAssign(event.target.value)}
            >
              <option value="">Choose tag…</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!tagToAssign || mutations.assignTag.isPending}
              onClick={() => {
                void submit(
                  mutations.assignTag.mutateAsync(tagToAssign),
                  'Tag assigned',
                ).then(() => setTagToAssign(''))
              }}
            >
              Assign
            </Button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Communication consent">
        <div className="overflow-x-auto">
          <table className="w-full min-w-96 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 text-start font-semibold">Channel</th>
                {CONSENT_PURPOSES.map((purpose) => (
                  <th
                    key={purpose}
                    className="px-2 py-2 text-start font-semibold"
                  >
                    {purpose.toLowerCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONSENT_CHANNELS.map((channel) => (
                <tr
                  key={channel}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-2 py-2 font-medium">
                    {channel.toLowerCase()}
                  </td>
                  {CONSENT_PURPOSES.map((purpose) => {
                    const consent = consentByKey.get(`${channel}:${purpose}`)
                    const status = consent?.status ?? ''
                    return (
                      <td key={purpose} className="px-2 py-2">
                        {canManage ? (
                          <select
                            aria-label={`${channel} ${purpose} consent`}
                            className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-primary/50"
                            value={status}
                            onChange={(event) => {
                              const next = event.target.value
                              if (!next) {
                                return
                              }
                              void submit(
                                mutations.setConsent.mutateAsync({
                                  channel,
                                  purpose,
                                  status:
                                    next as (typeof CONSENT_STATUSES)[number],
                                }),
                                'Consent updated',
                              )
                            }}
                          >
                            <option value="">Not set</option>
                            {CONSENT_STATUSES.map((option) => (
                              <option key={option} value={option}>
                                {option.toLowerCase()}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusChip
                            tone={
                              status === 'GRANTED'
                                ? 'success'
                                : status === ''
                                  ? 'neutral'
                                  : 'danger'
                            }
                          >
                            {status ? status.toLowerCase() : 'not set'}
                          </StatusChip>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Preferences & custom fields">
        {data.preferences.length === 0 && data.customFields.length === 0 ? (
          <WorkspaceEmptyState
            title="Nothing recorded"
            description="Stored preferences and tenant custom fields appear here."
          />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {data.preferences.map((preference) => (
              <div key={preference.id} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">
                  {preference.prefKey}
                </dt>
                <dd className="text-sm">
                  {JSON.stringify(preference.valueJson)}
                </dd>
              </div>
            ))}
            {data.customFields.map((value) => (
              <div key={value.id} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">
                  {value.definition.label}
                </dt>
                <dd className="text-sm">{JSON.stringify(value.valueJson)}</dd>
              </div>
            ))}
          </dl>
        )}
      </SectionCard>

      <DrawerForm
        open={contactDrawer}
        onOpenChange={setContactDrawer}
        title="Add contact point"
        isPending={mutations.upsertContact.isPending}
        onSubmit={async () => {
          if (contactForm.value.trim() === '') {
            notifyError('Enter a contact value.')
            return
          }
          await submit(
            mutations.upsertContact.mutateAsync({
              contactType: contactForm.contactType,
              label: contactForm.label.trim() || null,
              value: contactForm.value.trim(),
              isPrimary: contactForm.isPrimary,
            }),
            'Contact added',
          )
          setContactDrawer(false)
          setContactForm({
            contactType: 'PHONE',
            label: '',
            value: '',
            isPrimary: false,
          })
        }}
      >
        <Field label="Type">
          <select
            className={fieldInputClassName}
            value={contactForm.contactType}
            onChange={(event) =>
              setContactForm((previous) => ({
                ...previous,
                contactType: event.target
                  .value as (typeof CONTACT_TYPES)[number],
              }))
            }
          >
            {CONTACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Value" required>
          <Input
            value={contactForm.value}
            onChange={(event) =>
              setContactForm((previous) => ({
                ...previous,
                value: event.target.value,
              }))
            }
            placeholder="+20 100 000 0000 / name@example.com"
          />
        </Field>
        <Field label="Label" hint="Optional, e.g. work, home">
          <Input
            value={contactForm.label}
            onChange={(event) =>
              setContactForm((previous) => ({
                ...previous,
                label: event.target.value,
              }))
            }
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={contactForm.isPrimary}
            onChange={(event) =>
              setContactForm((previous) => ({
                ...previous,
                isPrimary: event.target.checked,
              }))
            }
            className="size-4 accent-primary"
          />
          Primary contact
        </label>
      </DrawerForm>

      <DrawerForm
        open={addressDrawer}
        onOpenChange={setAddressDrawer}
        title="Add address"
        isPending={mutations.upsertAddress.isPending}
        onSubmit={async () => {
          if (addressForm.line1.trim() === '') {
            notifyError('Enter the address line.')
            return
          }
          await submit(
            mutations.upsertAddress.mutateAsync({
              addressType: addressForm.addressType,
              label: addressForm.label.trim() || null,
              addressJson: {
                line1: addressForm.line1.trim(),
                city: addressForm.city.trim() || null,
              },
              deliveryInstructions: addressForm.notes.trim() || null,
              isDefault: addressForm.isDefault,
            }),
            'Address added',
          )
          setAddressDrawer(false)
          setAddressForm({
            addressType: 'DELIVERY',
            label: '',
            line1: '',
            city: '',
            notes: '',
            isDefault: false,
          })
        }}
      >
        <Field label="Type">
          <select
            className={fieldInputClassName}
            value={addressForm.addressType}
            onChange={(event) =>
              setAddressForm((previous) => ({
                ...previous,
                addressType: event.target
                  .value as (typeof ADDRESS_TYPES)[number],
              }))
            }
          >
            {ADDRESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Address line" required>
          <Input
            value={addressForm.line1}
            onChange={(event) =>
              setAddressForm((previous) => ({
                ...previous,
                line1: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="City">
          <Input
            value={addressForm.city}
            onChange={(event) =>
              setAddressForm((previous) => ({
                ...previous,
                city: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Label">
          <Input
            value={addressForm.label}
            onChange={(event) =>
              setAddressForm((previous) => ({
                ...previous,
                label: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Delivery instructions">
          <Input
            value={addressForm.notes}
            onChange={(event) =>
              setAddressForm((previous) => ({
                ...previous,
                notes: event.target.value,
              }))
            }
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={addressForm.isDefault}
            onChange={(event) =>
              setAddressForm((previous) => ({
                ...previous,
                isDefault: event.target.checked,
              }))
            }
            className="size-4 accent-primary"
          />
          Default address
        </label>
      </DrawerForm>

      <DrawerForm
        open={relationshipDrawer}
        onOpenChange={setRelationshipDrawer}
        title="Add relationship"
        isPending={mutations.upsertRelationship.isPending}
        onSubmit={async () => {
          if (relationshipForm.relatedName.trim() === '') {
            notifyError('Enter the related person’s name.')
            return
          }
          await submit(
            mutations.upsertRelationship.mutateAsync({
              relationType: relationshipForm.relationType,
              relatedName: relationshipForm.relatedName.trim(),
              phone: relationshipForm.phone.trim() || null,
              note: relationshipForm.note.trim() || null,
            }),
            'Relationship added',
          )
          setRelationshipDrawer(false)
          setRelationshipForm({
            relationType: 'FAMILY',
            relatedName: '',
            phone: '',
            note: '',
          })
        }}
      >
        <Field label="Relation">
          <select
            className={fieldInputClassName}
            value={relationshipForm.relationType}
            onChange={(event) =>
              setRelationshipForm((previous) => ({
                ...previous,
                relationType: event.target
                  .value as (typeof RELATION_TYPES)[number],
              }))
            }
          >
            {RELATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" required>
          <Input
            value={relationshipForm.relatedName}
            onChange={(event) =>
              setRelationshipForm((previous) => ({
                ...previous,
                relatedName: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Phone">
          <Input
            value={relationshipForm.phone}
            onChange={(event) =>
              setRelationshipForm((previous) => ({
                ...previous,
                phone: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Note">
          <Input
            value={relationshipForm.note}
            onChange={(event) =>
              setRelationshipForm((previous) => ({
                ...previous,
                note: event.target.value,
              }))
            }
          />
        </Field>
      </DrawerForm>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title={`Remove ${pendingDelete?.kind ?? ''}?`}
        description={`This removes ${pendingDelete?.label ?? 'the record'} from the customer profile.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!pendingDelete) {
            return
          }
          const action =
            pendingDelete.kind === 'contact'
              ? mutations.deleteContact.mutateAsync(pendingDelete.id)
              : pendingDelete.kind === 'address'
                ? mutations.deleteAddress.mutateAsync(pendingDelete.id)
                : mutations.deleteRelationship.mutateAsync(pendingDelete.id)
          await submit(action, 'Removed')
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
