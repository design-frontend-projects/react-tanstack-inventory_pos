'use client'

import { Skeleton } from '#/components/ui/skeleton'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { useEntityAuditTrail } from '#/features/audit/use-audit-trail'

// Generic activity/audit trail for any audited entity. Renders the AuditLog
// rows written by the domain services (actionKey + actor + JSON change diff)
// as a vertical timeline. Drop into a detail page Activity tab:
//   <AuditTrail entityType="product" entityId={product.id} />

interface AuditTrailProps {
  entityType: string
  entityId: string | null
  limit?: number
  emptyTitle?: string
  emptyDescription?: string
}

function formatActionKey(actionKey: string) {
  const leaf = actionKey.split('.').pop() ?? actionKey

  return leaf
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function summarizeValues(values: unknown): string | null {
  if (!values || typeof values !== 'object') {
    return null
  }

  const entries = Object.entries(values as Record<string, unknown>)

  if (entries.length === 0) {
    return null
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}: ${value.join(', ')}`
        : `${key}: ${String(value)}`,
    )
    .join(' · ')
}

export function AuditTrail({
  entityType,
  entityId,
  limit = 50,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Changes to this record will appear here as they happen.',
}: AuditTrailProps) {
  const trailQuery = useEntityAuditTrail(entityType, entityId, limit)

  if (trailQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  if (trailQuery.isError) {
    return (
      <WorkspaceEmptyState
        title="Unable to load activity"
        description="The audit trail could not be loaded. You may not have access to it."
        className="border-destructive/30 bg-destructive/4"
      />
    )
  }

  const entries = trailQuery.data ?? []

  if (entries.length === 0) {
    return (
      <WorkspaceEmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return (
    <ol className="relative flex flex-col gap-0 border-s border-border ps-5">
      {entries.map((entry) => {
        const changes = summarizeValues(entry.newValues)

        return (
          <li key={entry.id} className="relative pb-5 last:pb-0">
            <span
              aria-hidden
              className="absolute -inset-s-[1.4rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {formatActionKey(entry.actionKey)}
              </p>
              <time className="text-xs text-muted-foreground">
                {formatTimestamp(entry.createdAt)}
              </time>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {entry.actorEmail ?? 'System'}
            </p>
            {changes ? (
              <p className="mt-1 break-all rounded-md bg-muted/60 px-2 py-1 font-mono text-[0.7rem] leading-5 text-muted-foreground">
                {changes}
              </p>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
