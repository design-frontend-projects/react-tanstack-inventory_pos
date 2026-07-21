'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { usePermissions } from '#/features/auth/use-permissions'

// Every inventory/purchasing document (requisition, PO, goods receipt, return,
// adjustment, transfer, stock count) shares a draft → submitted → approved →
// posted style lifecycle. This renders the current status plus the transitions
// the actor is actually allowed to perform, with confirmation for irreversible
// steps, so no screen re-implements the pattern.

export interface DocumentTransition {
  id: string
  label: string
  // Any one of these permission codes grants the action.
  permissions?: Array<string>
  onAction: () => void | Promise<void>
  // Present a confirmation step before running the action.
  confirm?: {
    title: string
    description?: string
    confirmLabel?: string
    tone?: 'default' | 'destructive'
  }
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost'
  icon?: React.ReactNode
  disabled?: boolean
}

export function DocumentStatusFlow({
  status,
  tone = 'neutral',
  transitions,
  isPending = false,
  className,
}: {
  status: string
  tone?: StatusTone
  transitions: DocumentTransition[]
  isPending?: boolean
  className?: string
}) {
  const { can } = usePermissions()
  const [pendingTransition, setPendingTransition] =
    React.useState<DocumentTransition | null>(null)

  const allowed = transitions.filter((transition) =>
    can(transition.permissions ?? []),
  )

  async function run(transition: DocumentTransition) {
    await transition.onAction()
    setPendingTransition(null)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <StatusChip tone={tone} dot>
        {status}
      </StatusChip>

      {allowed.map((transition) => (
        <Button
          key={transition.id}
          type="button"
          size="sm"
          variant={transition.variant ?? 'outline'}
          disabled={isPending || transition.disabled}
          onClick={() => {
            if (transition.confirm) {
              setPendingTransition(transition)
              return
            }
            void run(transition)
          }}
        >
          {transition.icon}
          {transition.label}
        </Button>
      ))}

      {pendingTransition?.confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingTransition(null)
            }
          }}
          title={pendingTransition.confirm.title}
          description={pendingTransition.confirm.description}
          confirmLabel={
            pendingTransition.confirm.confirmLabel ?? pendingTransition.label
          }
          tone={pendingTransition.confirm.tone ?? 'default'}
          isPending={isPending}
          onConfirm={() => run(pendingTransition)}
        />
      ) : null}
    </div>
  )
}

// Shared status → tone mapping for inventory/purchasing document states, so the
// same status string always reads the same colour across modules.
const statusToneMap: Record<string, StatusTone> = {
  draft: 'neutral',
  pending: 'warning',
  submitted: 'info',
  pending_approval: 'warning',
  awaiting_approval: 'warning',
  approved: 'success',
  confirmed: 'success',
  partially_received: 'info',
  received: 'success',
  in_transit: 'info',
  shipped: 'info',
  posted: 'success',
  completed: 'success',
  closed: 'neutral',
  converted: 'primary',
  counting: 'info',
  review: 'warning',
  rejected: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
}

export function documentStatusTone(
  status: string | null | undefined,
): StatusTone {
  if (!status) {
    return 'neutral'
  }
  return statusToneMap[status.toLowerCase()] ?? 'neutral'
}

export function formatDocumentStatus(
  status: string | null | undefined,
): string {
  if (!status) {
    return 'Unknown'
  }
  return status
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
