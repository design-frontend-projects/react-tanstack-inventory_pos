'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'

// Reusable filter row: native selects + search + tab pill-group. Matches the
// hand-rolled inline filter convention used in inventory/purchasing workspaces.

export const filterSelectClassName =
  'h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

export interface FilterSelectOption {
  value: string
  label: string
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  includeAll = true,
  allLabel = 'All',
}: {
  label: string
  value: string
  options: FilterSelectOption[]
  onChange: (value: string) => void
  includeAll?: boolean
  allLabel?: string
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className={filterSelectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {includeAll ? <option value="">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterSearch({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-9 min-w-40 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50',
        className,
      )}
    />
  )
}

export interface FilterTab {
  value: string
  label: string
  count?: number
}

export function FilterTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: FilterTab[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-card p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span className="ms-1 tabular-nums opacity-70">{tab.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  )
}
