'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PlusIcon, Trash2Icon } from 'lucide-react'

import { StatusChip } from '#/components/board/status-chip'
import { filterSelectClassName } from '#/components/data/filter-bar'
import { fieldInputClassName } from '#/components/forms/drawer-form'
import { DetailPage, DetailPageHeader } from '#/components/layout/detail-page'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { formatNumber, toNumber } from '#/features/finance/finance-format'
import type { JournalEntryDetail } from '#/features/finance/use-fin-journals'
import {
  useJournalMutations,
  useJournalTypes,
} from '#/features/finance/use-fin-journals'
import { useFinAccounts } from '#/features/finance/use-fin-accounts'
import { getErrorMessage, notifySuccess } from '#/lib/toast/toast-store'

// Full-page journal entry editor: header, inline line grid, live totals, and a
// validation panel. Creates a new draft or re-saves an existing one — posted
// entries never reach this surface.

interface EditorLine {
  key: string
  accountId: string
  description: string
  debit: string
  credit: string
}

let lineCounter = 0

function newLine(): EditorLine {
  lineCounter += 1
  return {
    key: `line-${lineCounter}`,
    accountId: '',
    description: '',
    debit: '',
    credit: '',
  }
}

function toDateInputValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function linesFromEntry(entry: JournalEntryDetail): Array<EditorLine> {
  return entry.lines.map((line) => {
    lineCounter += 1
    return {
      key: `line-${lineCounter}`,
      accountId: line.accountId,
      description: line.description ?? '',
      debit: toNumber(line.debitAmount) > 0 ? line.debitAmount : '',
      credit: toNumber(line.creditAmount) > 0 ? line.creditAmount : '',
    }
  })
}

// A row participates in the entry once it names an account or carries a value.
function isLineUsed(line: EditorLine): boolean {
  return (
    line.accountId !== '' ||
    line.debit.trim() !== '' ||
    line.credit.trim() !== ''
  )
}

export function collectLineIssues(lines: Array<EditorLine>): Array<string> {
  const issues: Array<string> = []
  const used = lines.filter(isLineUsed)

  if (used.length < 2) {
    issues.push('A journal entry needs at least two lines.')
  }

  used.forEach((line) => {
    const index = lines.indexOf(line) + 1
    const debit = toNumber(line.debit)
    const credit = toNumber(line.credit)

    if (!line.accountId) {
      issues.push(`Line ${index}: select an account.`)
    }
    if (debit === 0 && credit === 0) {
      issues.push(`Line ${index}: enter a debit or credit amount.`)
    }
    if (debit > 0 && credit > 0) {
      issues.push(
        `Line ${index}: a line carries either a debit or a credit, not both.`,
      )
    }
    if (debit < 0 || credit < 0) {
      issues.push(`Line ${index}: amounts must be positive.`)
    }
  })

  const totalDebit = used.reduce((sum, line) => sum + toNumber(line.debit), 0)
  const totalCredit = used.reduce((sum, line) => sum + toNumber(line.credit), 0)

  if (used.length >= 2 && Math.abs(totalDebit - totalCredit) > 0.005) {
    issues.push(
      `Entry is out of balance by ${formatNumber(Math.abs(totalDebit - totalCredit))}.`,
    )
  }

  return issues
}

export function JournalEntryEditor({
  entry = null,
}: {
  // Existing draft to edit; null starts a fresh entry.
  entry?: JournalEntryDetail | null
}) {
  const navigate = useNavigate()
  const isEdit = entry !== null
  const typesQuery = useJournalTypes()
  const accountsQuery = useFinAccounts({ isActive: true })
  const { createEntry, updateEntry } = useJournalMutations()

  const [entryDate, setEntryDate] = React.useState(() =>
    entry ? toDateInputValue(entry.entryDate) : toDateInputValue(new Date()),
  )
  const [journalTypeCode, setJournalTypeCode] = React.useState(
    entry?.journalType.code ?? 'general',
  )
  const [referenceNumber, setReferenceNumber] = React.useState(
    entry?.referenceNumber ?? '',
  )
  const [memo, setMemo] = React.useState(entry?.memo ?? '')
  const [currencyCode, setCurrencyCode] = React.useState(
    entry?.currencyCode ?? 'USD',
  )
  const [exchangeRate, setExchangeRate] = React.useState('1')
  const [lines, setLines] = React.useState<Array<EditorLine>>(() =>
    entry ? [...linesFromEntry(entry), newLine()] : [newLine(), newLine()],
  )
  const [error, setError] = React.useState<string | null>(null)

  // Manual journals may only hit active, postable leaf accounts.
  const postableAccounts = React.useMemo(
    () =>
      (accountsQuery.data ?? []).filter(
        (account) => account.isLeaf && account.allowManualJournal,
      ),
    [accountsQuery.data],
  )

  const setLine = (key: string, patch: Partial<EditorLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  // Debit and credit are mutually exclusive on a line: typing one side clears
  // the other.
  const setAmount = (key: string, side: 'debit' | 'credit', value: string) => {
    setLine(
      key,
      side === 'debit'
        ? { debit: value, ...(value ? { credit: '' } : {}) }
        : { credit: value, ...(value ? { debit: '' } : {}) },
    )
  }

  const addLine = () => setLines((current) => [...current, newLine()])

  const removeLine = (key: string) => {
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    )
  }

  // Keep one trailing blank row so entry flows without reaching for the button.
  React.useEffect(() => {
    setLines((current) => {
      const last = current.at(-1)
      return !last || isLineUsed(last) ? [...current, newLine()] : current
    })
  }, [lines])

  const usedLines = lines.filter(isLineUsed)
  const totalDebit = usedLines.reduce(
    (sum, line) => sum + toNumber(line.debit),
    0,
  )
  const totalCredit = usedLines.reduce(
    (sum, line) => sum + toNumber(line.credit),
    0,
  )
  const difference = totalDebit - totalCredit
  const isBalanced = Math.abs(difference) <= 0.005 && usedLines.length >= 2

  const issues = collectLineIssues(lines)
  const isPending = createEntry.isPending || updateEntry.isPending
  const canSubmit = issues.length === 0 && entryDate !== '' && !isPending

  async function handleSave() {
    setError(null)
    const rate = toNumber(exchangeRate) > 0 ? exchangeRate : '1'
    const input = {
      journalTypeCode: journalTypeCode || undefined,
      entryDate: new Date(entryDate),
      referenceNumber: referenceNumber.trim() || null,
      memo: memo.trim() || null,
      currencyCode: currencyCode.trim().toUpperCase() || undefined,
      lines: usedLines.map((line) => ({
        accountId: line.accountId,
        description: line.description.trim() || null,
        currencyCode: currencyCode.trim().toUpperCase() || 'USD',
        exchangeRate: rate,
        ...(toNumber(line.debit) > 0 ? { debitAmount: line.debit } : {}),
        ...(toNumber(line.credit) > 0 ? { creditAmount: line.credit } : {}),
      })),
    }

    try {
      const saved = isEdit
        ? await updateEntry.mutateAsync({ id: entry.id, input })
        : await createEntry.mutateAsync(input)
      notifySuccess(
        isEdit ? 'Draft updated' : 'Draft created',
        `${saved.entryNumber} saved as draft.`,
      )
      navigate({
        to: '/finance/journals/$entryId',
        params: { entryId: saved.id },
      })
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError))
    }
  }

  return (
    <DetailPage
      isLoading={accountsQuery.isLoading || typesQuery.isLoading}
      header={
        <DetailPageHeader
          eyebrow="General Ledger"
          title={isEdit ? `Edit ${entry.entryNumber}` : 'New journal entry'}
          description={
            isEdit
              ? 'Rework this draft. Changes replace the entire line set.'
              : 'Capture a balanced double-entry voucher. It saves as a draft you can review and post.'
          }
          backTo="/finance/journals"
          backLabel="Journal entries"
          status={
            <StatusChip tone={isBalanced ? 'success' : 'warning'} dot>
              {isBalanced
                ? 'Balanced'
                : `Off by ${formatNumber(Math.abs(difference))}`}
            </StatusChip>
          }
          actions={
            <>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  isEdit
                    ? navigate({
                        to: '/finance/journals/$entryId',
                        params: { entryId: entry.id },
                      })
                    : navigate({ to: '/finance/journals' })
                }
              >
                Cancel
              </Button>
              <Button disabled={!canSubmit} onClick={() => void handleSave()}>
                {isPending ? 'Saving…' : 'Save draft'}
              </Button>
            </>
          }
        />
      }
    >
      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Entry date <span className="text-primary">*</span>
          </span>
          <input
            type="date"
            className={fieldInputClassName}
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Journal</span>
          <select
            className={filterSelectClassName}
            value={journalTypeCode}
            onChange={(event) => setJournalTypeCode(event.target.value)}
          >
            {(typesQuery.data ?? []).map((type) => (
              <option key={type.id} value={type.code}>
                {type.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Reference</span>
          <input
            className={fieldInputClassName}
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder="External document #"
            maxLength={120}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Currency</span>
          <input
            className={fieldInputClassName}
            value={currencyCode}
            onChange={(event) =>
              setCurrencyCode(event.target.value.toUpperCase())
            }
            maxLength={3}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Exchange rate</span>
          <input
            type="number"
            min="0"
            step="any"
            className={fieldInputClassName}
            value={exchangeRate}
            onChange={(event) => setExchangeRate(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            To base currency. Keep 1 for base-currency entries.
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2 xl:col-span-5">
          <span className="font-medium">Description</span>
          <textarea
            className={`${fieldInputClassName} h-16 py-2`}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="What this entry records…"
            maxLength={2000}
          />
        </label>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="w-10 px-3 py-2 font-semibold">
                  #
                </th>
                <th scope="col" className="min-w-64 px-3 py-2 font-semibold">
                  Account
                </th>
                <th scope="col" className="min-w-48 px-3 py-2 font-semibold">
                  Line description
                </th>
                <th
                  scope="col"
                  className="w-36 px-3 py-2 text-end font-semibold"
                >
                  Debit
                </th>
                <th
                  scope="col"
                  className="w-36 px-3 py-2 text-end font-semibold"
                >
                  Credit
                </th>
                <th scope="col" className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr
                  key={line.key}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-3 py-2 align-middle text-xs text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      aria-label={`Line ${index + 1} account`}
                      className={`${filterSelectClassName} w-full`}
                      value={line.accountId}
                      onChange={(event) =>
                        setLine(line.key, { accountId: event.target.value })
                      }
                    >
                      <option value="">Select account…</option>
                      {postableAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} — {account.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      aria-label={`Line ${index + 1} description`}
                      className={fieldInputClassName}
                      value={line.description}
                      onChange={(event) =>
                        setLine(line.key, { description: event.target.value })
                      }
                      maxLength={500}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      aria-label={`Line ${index + 1} debit`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      className={`${fieldInputClassName} text-end tabular-nums`}
                      value={line.debit}
                      onChange={(event) =>
                        setAmount(line.key, 'debit', event.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      aria-label={`Line ${index + 1} credit`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      className={`${fieldInputClassName} text-end tabular-nums`}
                      value={line.credit}
                      onChange={(event) =>
                        setAmount(line.key, 'credit', event.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-end align-middle">
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Remove line ${index + 1}`}
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/40 font-medium">
                <td className="px-3 py-2.5" colSpan={3}>
                  <Button size="xs" variant="outline" onClick={addLine}>
                    <PlusIcon className="size-4" />
                    Add line
                  </Button>
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums">
                  {formatNumber(totalDebit)}
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums">
                  {formatNumber(totalCredit)}
                </td>
                <td />
              </tr>
              <tr className="text-xs text-muted-foreground">
                <td className="px-3 pb-3" colSpan={3}>
                  {usedLines.length} lines · {currencyCode || '—'}
                </td>
                <td className="px-3 pb-3 text-end" colSpan={2}>
                  Difference:{' '}
                  <span
                    className={
                      isBalanced
                        ? 'font-semibold text-foreground'
                        : 'font-semibold text-destructive'
                    }
                  >
                    {formatNumber(difference)}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {issues.length > 0 ? (
        <WorkspaceEmptyState
          title="Before you can save"
          description="Resolve the checks below — the ledger only accepts complete, balanced entries."
        >
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            {issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500"
                />
                {issue}
              </li>
            ))}
          </ul>
        </WorkspaceEmptyState>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </DetailPage>
  )
}
