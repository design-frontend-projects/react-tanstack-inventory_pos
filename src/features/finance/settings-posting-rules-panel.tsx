'use client'

import * as React from 'react'

import { StatusChip } from '#/components/board/status-chip'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { Button } from '#/components/ui/button'
import type { PostingRuleRow } from '#/features/finance/use-fin-settings'
import {
  useFinSettingsMutations,
  usePostingRules,
} from '#/features/finance/use-fin-settings'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

// Posting rules drive event → journal automation. Rules and their debit/credit
// line templates are seeded; this panel reviews them and toggles activation.

function ruleLineSummary(rule: PostingRuleRow): string {
  return rule.lines
    .map(
      (line) =>
        `${line.side === 'debit' ? 'DR' : 'CR'} ${line.lineRole} ← ${line.accountSource}`,
    )
    .join('  ·  ')
}

export function PostingRulesPanel({ canManage }: { canManage: boolean }) {
  const rulesQuery = usePostingRules()
  const { upsertPostingRule } = useFinSettingsMutations()
  const [pendingToggle, setPendingToggle] =
    React.useState<PostingRuleRow | null>(null)

  // Re-submitting a rule with its own lines and the flag flipped is the only
  // toggle the API offers — the rule schema always carries the full line set.
  async function toggleRule(rule: PostingRuleRow) {
    try {
      await upsertPostingRule.mutateAsync({
        eventType: rule.eventType,
        sourceDocType: rule.sourceDocType,
        journalTypeCode: rule.journalTypeCode,
        description: rule.description,
        priority: rule.priority,
        isActive: !rule.isActive,
        lines: rule.lines.map((line) => ({
          lineNumber: line.lineNumber,
          lineRole: line.lineRole,
          side: line.side as 'debit' | 'credit',
          accountSource: line.accountSource as
            | 'fixed'
            | 'mapping'
            | 'settings_default',
          accountId: line.accountId,
          mappingEntityType: line.mappingEntityType,
          mappingRole: line.mappingRole,
          settingsField: line.settingsField,
          amountSelector: line.amountSelector,
          multiplier: line.multiplier,
          description: line.description,
        })),
      })
      notifySuccess(
        rule.isActive ? 'Rule deactivated' : 'Rule activated',
        rule.eventType,
      )
      setPendingToggle(null)
    } catch (error: unknown) {
      notifyError(error, 'Could not update the posting rule')
    }
  }

  const columns: Array<DataTableColumn<PostingRuleRow>> = [
    {
      id: 'eventType',
      header: 'Event',
      alwaysVisible: true,
      cell: (row) => (
        <span className="font-mono text-xs font-semibold">{row.eventType}</span>
      ),
      sortValue: (row) => row.eventType,
    },
    {
      id: 'sourceDocType',
      header: 'Source Doc',
      cell: (row) => row.sourceDocType ?? '—',
      sortValue: (row) => row.sourceDocType ?? '',
    },
    {
      id: 'journalTypeCode',
      header: 'Journal',
      cell: (row) => row.journalTypeCode ?? 'general',
      sortValue: (row) => row.journalTypeCode ?? '',
    },
    {
      id: 'lines',
      header: 'Line Template',
      cell: (row) => (
        <span className="line-clamp-1 max-w-md text-xs text-muted-foreground">
          {ruleLineSummary(row)}
        </span>
      ),
      exportValue: (row) => ruleLineSummary(row),
    },
    {
      id: 'priority',
      header: 'Priority',
      align: 'end',
      defaultHidden: true,
      cell: (row) => row.priority,
      sortValue: (row) => row.priority,
    },
    {
      id: 'scope',
      header: 'Scope',
      defaultHidden: true,
      cell: (row) => (
        <StatusChip tone={row.tenantId ? 'primary' : 'neutral'}>
          {row.tenantId ? 'tenant' : 'system'}
        </StatusChip>
      ),
      sortValue: (row) => (row.tenantId ? 'tenant' : 'system'),
      exportValue: (row) => (row.tenantId ? 'tenant' : 'system'),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'} dot>
          {row.isActive ? 'active' : 'inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 'active' : 'inactive'),
      exportValue: (row) => (row.isActive ? 'active' : 'inactive'),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (row) =>
        canManage ? (
          <Button
            size="xs"
            variant={row.isActive ? 'destructive' : 'outline'}
            onClick={() => setPendingToggle(row)}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        When a business event fires (a sale closes, a receipt posts, stock
        adjusts), the highest-priority active rule for that event builds the
        journal entry from its line template. Deactivated events queue as
        posting exceptions instead.
      </p>

      <DataTable
        columns={columns}
        rows={rulesQuery.data ?? []}
        rowKey={(row) => row.id}
        isLoading={rulesQuery.isLoading}
        isError={rulesQuery.isError}
        errorMessage="Could not load posting rules."
        emptyTitle="No posting rules"
        emptyDescription="Posting rules are seeded with the finance foundation and activate per module adapter."
        pageSize={15}
        enableColumnVisibility
        exportFileName="posting-rules"
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingToggle(null)
          }
        }}
        title={
          pendingToggle?.isActive
            ? `Deactivate rule for ${pendingToggle.eventType}?`
            : `Activate rule for ${pendingToggle?.eventType}?`
        }
        description={
          pendingToggle?.isActive
            ? 'Events of this type will stop generating journals and will wait in the posting queue.'
            : 'Events of this type will start generating journals automatically.'
        }
        confirmLabel={pendingToggle?.isActive ? 'Deactivate' : 'Activate'}
        tone={pendingToggle?.isActive ? 'destructive' : 'default'}
        isPending={upsertPostingRule.isPending}
        onConfirm={() => {
          if (pendingToggle) {
            void toggleRule(pendingToggle)
          }
        }}
      />
    </div>
  )
}
