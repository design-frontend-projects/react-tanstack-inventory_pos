'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'

// Shared scaffold for entity/document detail surfaces (product detail, document
// drawers). Pairs with Tabs for the tabbed hub pages and DocumentStatusFlow for
// lifecycle actions.

export function DetailPageHeader({
  eyebrow,
  title,
  description,
  backTo,
  backLabel = 'Back',
  status,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  backTo?: LinkProps['to']
  backLabel?: string
  status?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {backTo ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
        >
          <Link to={backTo}>
            <ArrowLeftIcon className="rtl:rotate-180" />
            {backLabel}
          </Link>
        </Button>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow ? <span className="ops-kicker">{eyebrow}</span> : null}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            {status}
          </div>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}

export interface DetailMetaEntry {
  label: string
  value: React.ReactNode
}

export function DetailMetaGrid({
  entries,
  className,
}: {
  entries: DetailMetaEntry[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
    >
      {entries.map((entry) => (
        <div key={entry.label} className="flex flex-col gap-1">
          <dt className="ops-panel-label">{entry.label}</dt>
          <dd className="text-sm font-medium text-foreground">{entry.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// Wraps the header + body, and centralizes the loading / not-found states so
// every detail screen renders them identically.
export function DetailPage({
  isLoading = false,
  isError = false,
  notFound = false,
  errorMessage = 'We could not load this record.',
  notFoundTitle = 'Record not found',
  notFoundDescription = 'It may have been deleted, or you may not have access to it.',
  header,
  children,
  className,
}: {
  isLoading?: boolean
  isError?: boolean
  notFound?: boolean
  errorMessage?: string
  notFoundTitle?: string
  notFoundDescription?: string
  header: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-6', className)}>
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className={cn('flex flex-col gap-6', className)}>
        {header}
        <WorkspaceEmptyState
          title="Unable to load"
          description={errorMessage}
          className="border-destructive/30 bg-destructive/[0.04]"
        />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={cn('flex flex-col gap-6', className)}>
        {header}
        <WorkspaceEmptyState
          title={notFoundTitle}
          description={notFoundDescription}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {header}
      {children}
    </div>
  )
}
