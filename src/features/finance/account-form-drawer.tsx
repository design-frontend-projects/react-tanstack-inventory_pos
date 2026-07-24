'use client'

import * as React from 'react'

import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { filterSelectClassName } from '#/components/data/filter-bar'
import type {
  FinAccountRow,
  FinAccountTypeRow,
} from '#/features/finance/use-fin-accounts'
import { useFinAccountMutations } from '#/features/finance/use-fin-accounts'
import { getErrorMessage, notifySuccess } from '#/lib/toast/toast-store'

// Create/edit drawer for a GL account. Create exposes the full schema; edit is
// limited to the fields the backend allows on an existing account (name,
// Arabic name, description, manual-journal flag, fixed currency).

interface AccountFormState {
  code: string
  name: string
  nameAr: string
  description: string
  parentAccountId: string
  accountTypeCode: string
  isControlAccount: boolean
  controlDomain: string
  allowManualJournal: boolean
  currencyCode: string
}

const EMPTY_FORM: AccountFormState = {
  code: '',
  name: '',
  nameAr: '',
  description: '',
  parentAccountId: '',
  accountTypeCode: '',
  isControlAccount: false,
  controlDomain: '',
  allowManualJournal: true,
  currencyCode: '',
}

function toFormState(
  account: FinAccountRow | null,
  defaultParentId: string | null,
): AccountFormState {
  if (!account) {
    return { ...EMPTY_FORM, parentAccountId: defaultParentId ?? '' }
  }
  return {
    code: account.code,
    name: account.name,
    nameAr: account.nameAr ?? '',
    description: account.description ?? '',
    parentAccountId: account.parentAccountId ?? '',
    accountTypeCode: account.accountType.code,
    isControlAccount: account.isControlAccount,
    controlDomain: account.controlDomain ?? '',
    allowManualJournal: account.allowManualJournal,
    currencyCode: account.currencyCode ?? '',
  }
}

export function AccountFormDrawer({
  open,
  onOpenChange,
  account,
  defaultParentId = null,
  accounts,
  accountTypes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Editing target; null creates a new account.
  account: FinAccountRow | null
  // Pre-selected parent when launched from a tree node's "Add child".
  defaultParentId?: string | null
  accounts: Array<FinAccountRow>
  accountTypes: Array<FinAccountTypeRow>
}) {
  const isEdit = account !== null
  const { createAccount, updateAccount } = useFinAccountMutations()
  const [form, setForm] = React.useState<AccountFormState>(() =>
    toFormState(account, defaultParentId),
  )
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setForm(toFormState(account, defaultParentId))
      setError(null)
    }
  }, [open, account, defaultParentId])

  const setField = <TKey extends keyof AccountFormState>(
    key: TKey,
    value: AccountFormState[TKey],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  // Group the type options by account class for a readable optgroup select.
  const typesByClass = React.useMemo(() => {
    const groups = new Map<string, Array<FinAccountTypeRow>>()
    for (const type of accountTypes) {
      const key = type.accountClass.name
      groups.set(key, [...(groups.get(key) ?? []), type])
    }
    return [...groups.entries()]
  }, [accountTypes])

  const parentOptions = React.useMemo(
    () =>
      accounts
        .filter((row) => row.id !== account?.id)
        .map((row) => ({ id: row.id, label: `${row.code} — ${row.name}` })),
    [accounts, account?.id],
  )

  const isPending = createAccount.isPending || updateAccount.isPending

  async function handleSubmit() {
    setError(null)
    try {
      if (isEdit) {
        await updateAccount.mutateAsync({
          id: account.id,
          input: {
            name: form.name,
            nameAr: form.nameAr || null,
            description: form.description || null,
            allowManualJournal: form.allowManualJournal,
            currencyCode: form.currencyCode || null,
          },
        })
        notifySuccess('Account updated', `${form.name} saved.`)
      } else {
        await createAccount.mutateAsync({
          code: form.code.trim(),
          name: form.name.trim(),
          nameAr: form.nameAr || null,
          description: form.description || null,
          parentAccountId: form.parentAccountId || null,
          accountTypeCode: form.accountTypeCode,
          isControlAccount: form.isControlAccount,
          controlDomain: form.isControlAccount
            ? form.controlDomain || null
            : null,
          allowManualJournal: form.allowManualJournal,
          currencyCode: form.currencyCode || null,
        })
        notifySuccess('Account created', `${form.name} added to the chart.`)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError))
    }
  }

  const submitDisabled = isEdit
    ? form.name.trim().length === 0
    : form.code.trim().length === 0 ||
      form.name.trim().length === 0 ||
      form.accountTypeCode.length === 0

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit ${account.code}` : 'New account'}
      description={
        isEdit
          ? 'Update the account presentation and posting behaviour.'
          : 'Add an account to the chart. Code and type are fixed after creation.'
      }
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Save changes' : 'Create account'}
      isPending={isPending}
      error={error}
      submitDisabled={submitDisabled}
    >
      {!isEdit ? (
        <Field label="Account code" htmlFor="fin-account-code" required>
          <input
            id="fin-account-code"
            className={fieldInputClassName}
            value={form.code}
            onChange={(event) => setField('code', event.target.value)}
            placeholder="e.g. 5210"
            maxLength={40}
          />
        </Field>
      ) : null}

      <Field label="Name" htmlFor="fin-account-name" required>
        <input
          id="fin-account-name"
          className={fieldInputClassName}
          value={form.name}
          onChange={(event) => setField('name', event.target.value)}
          placeholder="e.g. Marketing Expenses"
          maxLength={200}
        />
      </Field>

      <Field label="Arabic name" htmlFor="fin-account-name-ar">
        <input
          id="fin-account-name-ar"
          dir="rtl"
          className={fieldInputClassName}
          value={form.nameAr}
          onChange={(event) => setField('nameAr', event.target.value)}
          placeholder="الاسم بالعربية"
          maxLength={200}
        />
      </Field>

      <Field label="Description" htmlFor="fin-account-description">
        <textarea
          id="fin-account-description"
          className={`${fieldInputClassName} h-20 py-2`}
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
          maxLength={2000}
        />
      </Field>

      {!isEdit ? (
        <>
          <Field
            label="Account type"
            htmlFor="fin-account-type"
            required
            hint="Determines the class (asset, liability, equity, revenue, expense) and reporting placement."
          >
            <select
              id="fin-account-type"
              className={filterSelectClassName}
              value={form.accountTypeCode}
              onChange={(event) =>
                setField('accountTypeCode', event.target.value)
              }
            >
              <option value="">Select a type…</option>
              {typesByClass.map(([className, types]) => (
                <optgroup key={className} label={className}>
                  {types.map((type) => (
                    <option key={type.id} value={type.code}>
                      {type.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <Field
            label="Parent account"
            htmlFor="fin-account-parent"
            hint="Leave empty for a top-level account."
          >
            <select
              id="fin-account-parent"
              className={filterSelectClassName}
              value={form.parentAccountId}
              onChange={(event) =>
                setField('parentAccountId', event.target.value)
              }
            >
              <option value="">Top level</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}

      <Field
        label="Fixed currency"
        htmlFor="fin-account-currency"
        hint="Three-letter ISO code. Leave empty to accept any currency."
      >
        <input
          id="fin-account-currency"
          className={fieldInputClassName}
          value={form.currencyCode}
          onChange={(event) =>
            setField('currencyCode', event.target.value.toUpperCase())
          }
          placeholder="e.g. USD"
          maxLength={3}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.allowManualJournal}
          onChange={(event) =>
            setField('allowManualJournal', event.target.checked)
          }
        />
        <span>
          Allow manual journals
          <span className="block text-xs text-muted-foreground">
            Uncheck for subledger-controlled accounts that only automation may
            post to.
          </span>
        </span>
      </label>

      {!isEdit ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isControlAccount}
              onChange={(event) =>
                setField('isControlAccount', event.target.checked)
              }
            />
            <span>
              Control account
              <span className="block text-xs text-muted-foreground">
                Mirrors a subledger balance (receivables, payables, inventory,
                tax).
              </span>
            </span>
          </label>

          {form.isControlAccount ? (
            <Field
              label="Control domain"
              htmlFor="fin-account-control-domain"
              hint="e.g. ar, ap, inventory, tax"
            >
              <input
                id="fin-account-control-domain"
                className={fieldInputClassName}
                value={form.controlDomain}
                onChange={(event) =>
                  setField('controlDomain', event.target.value)
                }
                maxLength={40}
              />
            </Field>
          ) : null}
        </>
      ) : null}
    </DrawerForm>
  )
}
