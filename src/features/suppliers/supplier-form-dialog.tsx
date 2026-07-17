'use client'

import * as React from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  useSupplierCategories,
  useSupplierMutations,
} from '#/features/suppliers/use-suppliers'
import { supplierCreateSchema } from '#/features/suppliers/validation'

export type SupplierFormValues = {
  id: string
  code: string
  name: string
  email: string | null
  phone: string | null
  taxId: string | null
  categoryId: string | null
  paymentTerms: string | null
  currencyCode: string
  creditLimit: string | null
  leadTimeDays: number | null
  rating: string | null
  statusCode: string
  isPreferred: boolean
  isActive: boolean
}

const STATUS_OPTIONS = ['active', 'on_hold', 'blocked'] as const

type FormState = {
  code: string
  name: string
  email: string
  phone: string
  taxId: string
  categoryId: string
  paymentTerms: string
  currencyCode: string
  creditLimit: string
  leadTimeDays: string
  rating: string
  statusCode: string
  isPreferred: boolean
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  email: '',
  phone: '',
  taxId: '',
  categoryId: '',
  paymentTerms: '',
  currencyCode: 'USD',
  creditLimit: '',
  leadTimeDays: '',
  rating: '',
  statusCode: 'active',
  isPreferred: false,
  isActive: true,
}

function toFormState(supplier: SupplierFormValues | null): FormState {
  if (!supplier) {
    return EMPTY_FORM
  }

  return {
    code: supplier.code,
    name: supplier.name,
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    taxId: supplier.taxId ?? '',
    categoryId: supplier.categoryId ?? '',
    paymentTerms: supplier.paymentTerms ?? '',
    currencyCode: supplier.currencyCode,
    creditLimit: supplier.creditLimit ?? '',
    leadTimeDays:
      supplier.leadTimeDays === null ? '' : String(supplier.leadTimeDays),
    rating: supplier.rating ?? '',
    statusCode: supplier.statusCode,
    isPreferred: supplier.isPreferred,
    isActive: supplier.isActive,
  }
}

// Trims optional text inputs to `null` and coerces numerics so the payload
// matches supplierCreateSchema before it ever leaves the browser.
function toPayload(form: FormState) {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())

  return {
    code: form.code.trim(),
    name: form.name.trim(),
    email: text(form.email),
    phone: text(form.phone),
    taxId: text(form.taxId),
    categoryId: text(form.categoryId),
    paymentTerms: text(form.paymentTerms),
    currencyCode: form.currencyCode.trim().toUpperCase(),
    creditLimit: text(form.creditLimit),
    leadTimeDays:
      form.leadTimeDays.trim() === '' ? null : Number(form.leadTimeDays),
    rating: text(form.rating),
    statusCode: form.statusCode,
    isPreferred: form.isPreferred,
    isActive: form.isActive,
  }
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: SupplierFormValues | null
}) {
  const isEdit = supplier !== null
  const [form, setForm] = React.useState<FormState>(() => toFormState(supplier))
  const [error, setError] = React.useState<string | null>(null)
  const categoriesQuery = useSupplierCategories()
  const { createSupplier, updateSupplier, deleteSupplier } =
    useSupplierMutations()
  const isBusy =
    createSupplier.isPending ||
    updateSupplier.isPending ||
    deleteSupplier.isPending

  React.useEffect(() => {
    if (open) {
      setForm(toFormState(supplier))
      setError(null)
    }
  }, [open, supplier])

  const set = <TKey extends keyof FormState>(key: TKey, value: FormState[TKey]) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = supplierCreateSchema.safeParse(toPayload(form))

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      if (isEdit) {
        await updateSupplier.mutateAsync({
          id: supplier.id,
          input: parsed.data,
        })
      } else {
        await createSupplier.mutateAsync(parsed.data)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not save the supplier.',
      )
    }
  }

  async function handleDelete() {
    if (!isEdit) {
      return
    }

    setError(null)
    try {
      await deleteSupplier.mutateAsync(supplier.id)
      onOpenChange(false)
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete the supplier.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit supplier' : 'New supplier'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the vendor profile. Changes are audit-logged.'
              : 'Register a vendor in the supplier master.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code *">
              <Input
                value={form.code}
                onChange={(event) => set('code', event.target.value)}
                placeholder="SUP-001"
                disabled={isEdit}
                required
              />
            </Field>
            <Field label="Status">
              <select
                value={form.statusCode}
                onChange={(event) => set('statusCode', event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm capitalize outline-none focus:border-primary/50"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Acme Foods"
              required
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                placeholder="orders@acme.test"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category">
              <select
                value={form.categoryId}
                onChange={(event) => set('categoryId', event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
              >
                <option value="">Uncategorised</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tax ID">
              <Input
                value={form.taxId}
                onChange={(event) => set('taxId', event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Currency">
              <Input
                value={form.currencyCode}
                onChange={(event) => set('currencyCode', event.target.value)}
                maxLength={3}
              />
            </Field>
            <Field label="Credit limit">
              <Input
                inputMode="decimal"
                value={form.creditLimit}
                onChange={(event) => set('creditLimit', event.target.value)}
                placeholder="15000.00"
              />
            </Field>
            <Field label="Lead time (days)">
              <Input
                inputMode="numeric"
                value={form.leadTimeDays}
                onChange={(event) => set('leadTimeDays', event.target.value)}
                placeholder="7"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Payment terms">
              <Input
                value={form.paymentTerms}
                onChange={(event) => set('paymentTerms', event.target.value)}
                placeholder="Net 30"
              />
            </Field>
            <Field label="Rating (0–5)">
              <Input
                inputMode="decimal"
                value={form.rating}
                onChange={(event) => set('rating', event.target.value)}
                placeholder="4.5"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPreferred}
                onChange={(event) => set('isPreferred', event.target.checked)}
                className="size-4 accent-primary"
              />
              Preferred supplier
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => set('isActive', event.target.checked)}
                className="size-4 accent-primary"
              />
              Active
            </label>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-2">
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isBusy}
                onClick={handleDelete}
                className="sm:mr-auto"
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
