'use client'

import * as React from 'react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { filterSelectClassName } from '#/components/data/filter-bar'
import { Button } from '#/components/ui/button'
import {
  formatDate,
  formatNumber,
  toNumber,
} from '#/features/finance/finance-format'
import type {
  ExchangeRateRow,
  FinCurrencyRow,
} from '#/features/finance/use-fin-settings'
import {
  useExchangeRates,
  useFinCurrencies,
  useFinSettingsMutations,
} from '#/features/finance/use-fin-settings'
import { getErrorMessage, notifySuccess } from '#/lib/toast/toast-store'

// Currencies registry (read-only) + effective-dated exchange rates with upsert.

const RATE_TYPES = ['spot', 'average', 'closing', 'budget'] as const

export function CurrencyPanel({ canManage }: { canManage: boolean }) {
  const currenciesQuery = useFinCurrencies()
  const ratesQuery = useExchangeRates()
  const { upsertExchangeRate } = useFinSettingsMutations()

  const [rateOpen, setRateOpen] = React.useState(false)
  const [fromCode, setFromCode] = React.useState('')
  const [toCode, setToCode] = React.useState('')
  const [rateDate, setRateDate] = React.useState('')
  const [rate, setRate] = React.useState('')
  const [rateType, setRateType] = React.useState<string>('spot')
  const [error, setError] = React.useState<string | null>(null)

  const currencyColumns: Array<DataTableColumn<FinCurrencyRow>> = [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
      sortValue: (row) => row.code,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: 'symbol',
      header: 'Symbol',
      cell: (row) => row.symbol ?? '—',
      sortValue: (row) => row.symbol ?? '',
    },
    {
      id: 'decimals',
      header: 'Decimals',
      align: 'end',
      cell: (row) => row.decimalPlaces,
      sortValue: (row) => row.decimalPlaces,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 'active' : 'inactive'),
      exportValue: (row) => (row.isActive ? 'active' : 'inactive'),
    },
  ]

  const rateColumns: Array<DataTableColumn<ExchangeRateRow>> = [
    {
      id: 'pair',
      header: 'Pair',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold">
          {row.fromCurrencyCode} → {row.toCurrencyCode}
        </span>
      ),
      sortValue: (row) => `${row.fromCurrencyCode}${row.toCurrencyCode}`,
      exportValue: (row) => `${row.fromCurrencyCode}/${row.toCurrencyCode}`,
    },
    {
      id: 'rateDate',
      header: 'Effective From',
      cell: (row) => formatDate(row.rateDate),
      sortValue: (row) => new Date(row.rateDate).getTime(),
      exportValue: (row) => formatDate(row.rateDate),
    },
    {
      id: 'rate',
      header: 'Rate',
      align: 'end',
      cell: (row) => formatNumber(row.rate),
      sortValue: (row) => toNumber(row.rate),
      exportValue: (row) => row.rate,
    },
    {
      id: 'rateType',
      header: 'Type',
      cell: (row) => <StatusChip tone="info">{row.rateType}</StatusChip>,
      sortValue: (row) => row.rateType,
      exportValue: (row) => row.rateType,
    },
    {
      id: 'source',
      header: 'Source',
      defaultHidden: true,
      cell: (row) => row.source,
      sortValue: (row) => row.source,
    },
  ]

  async function handleUpsertRate() {
    setError(null)
    try {
      await upsertExchangeRate.mutateAsync({
        fromCurrencyCode: fromCode.trim().toUpperCase(),
        toCurrencyCode: toCode.trim().toUpperCase(),
        rateDate: new Date(rateDate),
        rate,
        rateType: rateType as (typeof RATE_TYPES)[number],
      })
      notifySuccess(
        'Exchange rate saved',
        `${fromCode.toUpperCase()} → ${toCode.toUpperCase()} @ ${rate}`,
      )
      setRateOpen(false)
      setFromCode('')
      setToCode('')
      setRateDate('')
      setRate('')
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Currencies
          </h3>
        </div>
        <DataTable
          columns={currencyColumns}
          rows={currenciesQuery.data ?? []}
          rowKey={(row) => row.id}
          isLoading={currenciesQuery.isLoading}
          isError={currenciesQuery.isError}
          errorMessage="Could not load currencies."
          emptyTitle="No currencies"
          emptyDescription="Currencies are seeded with the finance foundation."
          exportFileName="currencies"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Exchange rates
          </h3>
          {canManage ? (
            <Button size="sm" onClick={() => setRateOpen(true)}>
              New rate
            </Button>
          ) : null}
        </div>
        <DataTable
          columns={rateColumns}
          rows={ratesQuery.data ?? []}
          rowKey={(row) => row.id}
          isLoading={ratesQuery.isLoading}
          isError={ratesQuery.isError}
          errorMessage="Could not load exchange rates."
          emptyTitle="No exchange rates"
          emptyDescription="Add effective-dated rates for every non-base currency you post in."
          pageSize={15}
          exportFileName="exchange-rates"
        />
      </div>

      <DrawerForm
        open={rateOpen}
        onOpenChange={setRateOpen}
        title="New exchange rate"
        description="Effective-dated: postings on or after this date pick the newest matching rate."
        onSubmit={handleUpsertRate}
        submitLabel="Save rate"
        isPending={upsertExchangeRate.isPending}
        error={error}
        submitDisabled={
          fromCode.trim().length !== 3 ||
          toCode.trim().length !== 3 ||
          rateDate === '' ||
          toNumber(rate) <= 0
        }
      >
        <Field label="From currency" htmlFor="rate-from" required>
          <input
            id="rate-from"
            className={fieldInputClassName}
            value={fromCode}
            onChange={(event) => setFromCode(event.target.value.toUpperCase())}
            placeholder="e.g. EUR"
            maxLength={3}
          />
        </Field>
        <Field label="To currency" htmlFor="rate-to" required>
          <input
            id="rate-to"
            className={fieldInputClassName}
            value={toCode}
            onChange={(event) => setToCode(event.target.value.toUpperCase())}
            placeholder="e.g. USD"
            maxLength={3}
          />
        </Field>
        <Field label="Effective date" htmlFor="rate-date" required>
          <input
            id="rate-date"
            type="date"
            className={fieldInputClassName}
            value={rateDate}
            onChange={(event) => setRateDate(event.target.value)}
          />
        </Field>
        <Field label="Rate" htmlFor="rate-value" required>
          <input
            id="rate-value"
            type="number"
            min="0"
            step="any"
            className={fieldInputClassName}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </Field>
        <Field label="Rate type" htmlFor="rate-type">
          <select
            id="rate-type"
            className={filterSelectClassName}
            value={rateType}
            onChange={(event) => setRateType(event.target.value)}
          >
            {RATE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
      </DrawerForm>
    </div>
  )
}
