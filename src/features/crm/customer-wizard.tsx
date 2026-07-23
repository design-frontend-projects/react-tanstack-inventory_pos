'use client'

import * as React from 'react'
import { FormWizard } from '#/components/forms/form-wizard'
import { Field, fieldInputClassName } from '#/components/forms/drawer-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { useCrmCustomerMutations } from '#/features/crm/use-crm-customers'
import type { CustomerProfileInput } from '#/features/crm/use-crm-customers'
import { LIFECYCLE_STATUSES, formatLifecycle } from '#/features/crm/crm-format'
import { notifySuccess } from '#/lib/toast/toast-store'
import type { WizardStep } from '#/components/forms/form-wizard'

// Guided create flow for a customer: master record (catalog module) plus the
// CRM profile satellite, submitted together on Finish.

const CUSTOMER_TYPES = ['RETAIL', 'WHOLESALE', 'B2B'] as const

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

interface WizardFormState {
  code: string
  name: string
  customerType: (typeof CUSTOMER_TYPES)[number]
  email: string
  phone: string
  taxId: string
  creditLimit: string
  isCorporate: boolean
  companyName: string
  classification: string
  acquisitionChannel: string
  languageCode: string
  currencyCode: string
  timezone: string
  gender: string
  dateOfBirth: string
  anniversaryDate: string
  lifecycleStatus: (typeof LIFECYCLE_STATUSES)[number]
  vipLevel: string
  notes: string
}

const EMPTY_FORM: WizardFormState = {
  code: '',
  name: '',
  customerType: 'RETAIL',
  email: '',
  phone: '',
  taxId: '',
  creditLimit: '',
  isCorporate: false,
  companyName: '',
  classification: '',
  acquisitionChannel: '',
  languageCode: '',
  currencyCode: '',
  timezone: '',
  gender: '',
  dateOfBirth: '',
  anniversaryDate: '',
  lifecycleStatus: 'PROSPECT',
  vipLevel: '0',
  notes: '',
}

function text(value: string): string | null {
  return value.trim() === '' ? null : value.trim()
}

function toProfilePayload(form: WizardFormState): CustomerProfileInput {
  return {
    lifecycleStatus: form.lifecycleStatus,
    vipLevel: Number(form.vipLevel) || 0,
    isCorporate: form.isCorporate,
    companyName: text(form.companyName),
    classification: text(form.classification),
    acquisitionChannel: text(form.acquisitionChannel),
    languageCode: text(form.languageCode),
    currencyCode: text(form.currencyCode),
    timezone: text(form.timezone),
    gender: text(form.gender),
    dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : null,
    anniversaryDate: form.anniversaryDate
      ? new Date(form.anniversaryDate)
      : null,
    notes: text(form.notes),
  }
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

export function CustomerWizard({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = React.useState<WizardFormState>(EMPTY_FORM)
  const [error, setError] = React.useState<string | null>(null)
  const { createCustomer } = useCrmCustomerMutations()

  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setError(null)
    }
  }, [open])

  const set = <TKey extends keyof WizardFormState>(
    key: TKey,
    value: WizardFormState[TKey],
  ) => setForm((previous) => ({ ...previous, [key]: value }))

  const orDash = (value: string) => (value.trim() === '' ? '—' : value.trim())

  const steps: Array<WizardStep> = [
    {
      id: 'general',
      title: 'General',
      description: 'Identify the customer: code, name, and type.',
      validate: () => {
        if (form.code.trim() === '') {
          return 'Code is required.'
        }
        if (form.code.trim().length > 48) {
          return 'Code must be 48 characters or fewer.'
        }
        if (form.name.trim() === '') {
          return 'Name is required.'
        }
        if (form.name.trim().length > 160) {
          return 'Name must be 160 characters or fewer.'
        }
        return null
      },
    },
    {
      id: 'contact',
      title: 'Contact',
      description: 'Primary reach details on the master record.',
      validate: () => {
        const email = form.email.trim()
        if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return 'Enter a valid email address.'
        }
        return null
      },
    },
    {
      id: 'business',
      title: 'Business',
      description: 'Corporate details, classification, and credit.',
      validate: () => {
        const credit = form.creditLimit.trim()
        if (credit !== '' && !DECIMAL_PATTERN.test(credit)) {
          return 'Credit limit must be a number.'
        }
        return null
      },
    },
    {
      id: 'preferences',
      title: 'Preferences',
      description: 'Language, currency, timezone, and personal dates.',
    },
    {
      id: 'crm',
      title: 'CRM profile',
      description: 'Lifecycle stage, VIP level, and internal notes.',
      validate: () => {
        const vip = Number(form.vipLevel)
        if (!Number.isInteger(vip) || vip < 0 || vip > 100) {
          return 'VIP level must be a whole number between 0 and 100.'
        }
        return null
      },
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Confirm the record, then finish to create the customer.',
    },
  ]

  async function handleComplete() {
    setError(null)

    try {
      await createCustomer.mutateAsync({
        master: {
          code: form.code.trim(),
          name: form.name.trim(),
          customerType: form.customerType,
          email: text(form.email),
          phone: text(form.phone),
          taxId: text(form.taxId),
          creditLimit: text(form.creditLimit),
        },
        profile: toProfilePayload(form),
      })
      notifySuccess(
        'Customer created',
        `${form.name.trim()} joined the directory.`,
      )
      onOpenChange(false)
      setForm(EMPTY_FORM)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not create the customer.',
      )
    }
  }

  function renderStep(step: WizardStep) {
    switch (step.id) {
      case 'general':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" required>
              <Input
                value={form.code}
                onChange={(event) => set('code', event.target.value)}
                placeholder="CUST-0001"
              />
            </Field>
            <Field label="Name" required>
              <Input
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="Full name or business name"
              />
            </Field>
            <Field label="Customer type">
              <select
                value={form.customerType}
                onChange={(event) =>
                  set(
                    'customerType',
                    event.target.value as WizardFormState['customerType'],
                  )
                }
                className={fieldInputClassName}
              >
                {CUSTOMER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )
      case 'contact':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
              />
            </Field>
            <Field label="Tax ID">
              <Input
                value={form.taxId}
                onChange={(event) => set('taxId', event.target.value)}
              />
            </Field>
          </div>
        )
      case 'business':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isCorporate}
                onChange={(event) => set('isCorporate', event.target.checked)}
                className="size-4 accent-primary"
              />
              Corporate account
            </label>
            <Field label="Company name">
              <Input
                value={form.companyName}
                onChange={(event) => set('companyName', event.target.value)}
                disabled={!form.isCorporate}
              />
            </Field>
            <Field
              label="Classification"
              hint="Free-form grouping, e.g. gold, wholesale-tier-2"
            >
              <Input
                value={form.classification}
                onChange={(event) => set('classification', event.target.value)}
              />
            </Field>
            <Field
              label="Acquisition channel"
              hint="Where this customer came from"
            >
              <Input
                value={form.acquisitionChannel}
                onChange={(event) =>
                  set('acquisitionChannel', event.target.value)
                }
                placeholder="walk-in, instagram, referral…"
              />
            </Field>
            <Field label="Credit limit">
              <Input
                value={form.creditLimit}
                onChange={(event) => set('creditLimit', event.target.value)}
                inputMode="decimal"
              />
            </Field>
          </div>
        )
      case 'preferences':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Language" hint="BCP-47 code, e.g. en or ar">
              <Input
                value={form.languageCode}
                onChange={(event) => set('languageCode', event.target.value)}
              />
            </Field>
            <Field label="Currency" hint="ISO code, e.g. USD">
              <Input
                value={form.currencyCode}
                onChange={(event) => set('currencyCode', event.target.value)}
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={form.timezone}
                onChange={(event) => set('timezone', event.target.value)}
                placeholder="Africa/Cairo"
              />
            </Field>
            <Field label="Gender">
              <Input
                value={form.gender}
                onChange={(event) => set('gender', event.target.value)}
              />
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => set('dateOfBirth', event.target.value)}
              />
            </Field>
            <Field label="Anniversary">
              <Input
                type="date"
                value={form.anniversaryDate}
                onChange={(event) => set('anniversaryDate', event.target.value)}
              />
            </Field>
          </div>
        )
      case 'crm':
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lifecycle stage">
              <select
                value={form.lifecycleStatus}
                onChange={(event) =>
                  set(
                    'lifecycleStatus',
                    event.target.value as WizardFormState['lifecycleStatus'],
                  )
                }
                className={fieldInputClassName}
              >
                {LIFECYCLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLifecycle(status)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="VIP level" hint="0–100">
              <Input
                value={form.vipLevel}
                onChange={(event) => set('vipLevel', event.target.value)}
                inputMode="numeric"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Internal notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => set('notes', event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </Field>
            </div>
          </div>
        )
      case 'review':
        return (
          <dl className="grid gap-4 sm:grid-cols-2">
            <ReviewItem label="Code" value={orDash(form.code)} />
            <ReviewItem label="Name" value={orDash(form.name)} />
            <ReviewItem label="Type" value={form.customerType.toLowerCase()} />
            <ReviewItem label="Email" value={orDash(form.email)} />
            <ReviewItem label="Phone" value={orDash(form.phone)} />
            <ReviewItem
              label="Corporate"
              value={form.isCorporate ? orDash(form.companyName) : 'No'}
            />
            <ReviewItem
              label="Lifecycle"
              value={formatLifecycle(form.lifecycleStatus)}
            />
            <ReviewItem label="VIP level" value={form.vipLevel} />
            <ReviewItem
              label="Acquisition"
              value={orDash(form.acquisitionChannel)}
            />
            <ReviewItem label="Credit limit" value={orDash(form.creditLimit)} />
          </dl>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Create the master record and its CRM profile in one guided flow.
          </DialogDescription>
        </DialogHeader>
        <FormWizard
          steps={steps}
          renderStep={renderStep}
          onComplete={handleComplete}
          onCancel={() => onOpenChange(false)}
          completeLabel="Create customer"
          isPending={createCustomer.isPending}
          error={error}
        />
      </DialogContent>
    </Dialog>
  )
}
