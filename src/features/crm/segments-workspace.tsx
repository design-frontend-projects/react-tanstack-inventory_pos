'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { DrawerForm, Field } from '#/components/forms/drawer-form'
import { Input } from '#/components/ui/input'
import { StatusChip } from '#/components/board/status-chip'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  useSegmentMembers,
  useSegmentMutations,
  useSegments,
} from '#/features/crm/use-segments'
import type { SegmentRow } from '#/features/crm/use-segments'
import {
  SegmentRuleBuilder,
  emptyGroup,
} from '#/features/crm/segment-rule-builder'
import { segmentRuleSchema } from '#/server/crm/segment-evaluator'
import type { SegmentRuleGroup } from '#/server/crm/segment-evaluator'
import {
  errorMessage,
  formatDateTime,
  formatNumber,
} from '#/features/crm/crm-format'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

// Dynamic segmentation: declarative rules over customer facts, materialized
// membership, and on-demand rebuild. Membership stays current automatically as
// events fold through the segment projection.

interface SegmentFormState {
  id?: string
  code: string
  name: string
  description: string
  isActive: boolean
  rule: SegmentRuleGroup
}

export function CrmSegmentsWorkspace() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canManage = can(['crm.segment_manage'])

  const segmentsQuery = useSegments()
  const { upsertSegment, deleteSegment, rebuildSegment } = useSegmentMutations()

  const [formOpen, setFormOpen] = React.useState(false)
  const [form, setForm] = React.useState<SegmentFormState>({
    code: '',
    name: '',
    description: '',
    isActive: true,
    rule: emptyGroup(),
  })
  const [pendingDelete, setPendingDelete] = React.useState<SegmentRow | null>(
    null,
  )
  const [membersSegment, setMembersSegment] = React.useState<SegmentRow | null>(
    null,
  )

  const membersQuery = useSegmentMembers(membersSegment?.id ?? null)

  const segments = segmentsQuery.data ?? []
  const totalMembers = segments.reduce(
    (sum, segment) => sum + segment.memberCount,
    0,
  )

  function openCreate() {
    setForm({
      code: '',
      name: '',
      description: '',
      isActive: true,
      rule: emptyGroup(),
    })
    setFormOpen(true)
  }

  function openEdit(segment: SegmentRow) {
    const parsed = segmentRuleSchema.safeParse(segment.ruleJson)
    setForm({
      id: segment.id,
      code: segment.code,
      name: segment.name,
      description: segment.description ?? '',
      isActive: segment.isActive,
      rule: parsed.success ? parsed.data : emptyGroup(),
    })
    setFormOpen(true)
  }

  const columns: DataTableColumn<SegmentRow>[] = [
    {
      id: 'segment',
      header: 'Segment',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-xs text-muted-foreground">{row.code}</span>
        </div>
      ),
      sortValue: (row) => row.name,
      exportValue: (row) => row.name,
      alwaysVisible: true,
    },
    {
      id: 'members',
      header: 'Members',
      align: 'end',
      cell: (row) => formatNumber(row.memberCount),
      sortValue: (row) => row.memberCount,
      exportValue: (row) => row.memberCount,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 1 : 0),
    },
    {
      id: 'rebuilt',
      header: 'Last rebuilt',
      cell: (row) =>
        row.lastRebuiltAt ? formatDateTime(row.lastRebuiltAt) : 'Never',
      sortValue: (row) =>
        row.lastRebuiltAt ? new Date(row.lastRebuiltAt).getTime() : 0,
    },
    {
      id: 'actions',
      header: '',
      alwaysVisible: true,
      cell: (row) => (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="xs"
            variant="outline"
            onClick={() => setMembersSegment(row)}
          >
            Members
          </Button>
          {canManage ? (
            <>
              <Button
                size="xs"
                variant="outline"
                disabled={rebuildSegment.isPending}
                onClick={() => {
                  rebuildSegment.mutate(row.id, {
                    onSuccess: () => notifySuccess(`Rebuilt ${row.name}`),
                    onError: (error) => notifyError(errorMessage(error)),
                  })
                }}
              >
                Rebuild
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setPendingDelete(row)}
              >
                Delete
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Segmentation"
      title="Dynamic customer segments from declarative rules."
      description="Segments re-evaluate automatically when events change a customer's metrics; enter/exit transitions feed the timeline and future campaigns."
      actions={
        canManage ? (
          <Button size="sm" onClick={openCreate}>
            New segment
          </Button>
        ) : undefined
      }
      metrics={[
        {
          label: 'Segments',
          value: formatNumber(segments.length),
          hint: 'Defined rule sets',
          tone: 'red',
        },
        {
          label: 'Active',
          value: formatNumber(segments.filter((s) => s.isActive).length),
          hint: 'Evaluating on new events',
          tone: 'accent',
        },
        {
          label: 'Memberships',
          value: formatNumber(totalMembers),
          hint: 'Total customer-segment links',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Rules"
        title="Segment catalog"
        description="Open a segment to edit its rule tree, preview members, or trigger a full rebuild."
      >
        <DataTable
          columns={columns}
          rows={segments}
          rowKey={(row) => row.id}
          isLoading={segmentsQuery.isLoading}
          isError={segmentsQuery.isError}
          onRowClick={canManage ? openEdit : undefined}
          exportFileName="crm-segments"
          emptyTitle="No segments yet"
          emptyDescription="Define your first segment — e.g. big spenders: total spend ≥ 10,000."
        />
      </WorkspacePanel>

      <DrawerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={form.id ? `Edit segment: ${form.name}` : 'New segment'}
        description="Rules run against the flat customer facts built from metrics + profile."
        isPending={upsertSegment.isPending}
        className="sm:max-w-2xl"
        onSubmit={async () => {
          if (form.code.trim() === '' || form.name.trim() === '') {
            notifyError('Code and name are required.')
            return
          }
          const parsed = segmentRuleSchema.safeParse(form.rule)
          if (!parsed.success) {
            notifyError(
              'The rule tree is incomplete — every condition needs a value.',
            )
            return
          }
          try {
            await upsertSegment.mutateAsync({
              id: form.id,
              code: form.code.trim().toLowerCase(),
              name: form.name.trim(),
              description: form.description.trim() || null,
              ruleJson: parsed.data,
              isActive: form.isActive,
            })
            notifySuccess(
              'Segment saved',
              'Rebuild it to refresh membership immediately.',
            )
            setFormOpen(false)
          } catch (error: unknown) {
            notifyError(errorMessage(error))
          }
        }}
      >
        <Field label="Code" required hint="Lowercase, e.g. big-spenders">
          <Input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
            disabled={Boolean(form.id)}
          />
        </Field>
        <Field label="Name" required>
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Description">
          <Input
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm({ ...form, isActive: event.target.checked })
            }
            className="size-4 accent-primary"
          />
          Active
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Rule</span>
          <SegmentRuleBuilder
            group={form.rule}
            onChange={(rule) => setForm({ ...form, rule })}
          />
        </div>
      </DrawerForm>

      <DrawerForm
        open={membersSegment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMembersSegment(null)
          }
        }}
        title={membersSegment ? `Members: ${membersSegment.name}` : 'Members'}
        description={`${formatNumber(membersSegment?.memberCount ?? 0)} customers currently match.`}
        onSubmit={() => setMembersSegment(null)}
        submitLabel="Close"
        className="sm:max-w-xl"
      >
        {membersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : (membersQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No customers match this segment yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(membersQuery.data ?? []).map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-border/70 px-3 py-2 text-start text-sm hover:bg-muted/50"
                  onClick={() =>
                    void navigate({
                      to: '/crm/customers/$customerId',
                      params: { customerId: member.customerId },
                    })
                  }
                >
                  <span className="font-medium">
                    {member.customerName ?? member.customerId}
                  </span>
                  <span className="ms-2 text-xs text-muted-foreground">
                    joined {formatDateTime(member.addedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DrawerForm>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
        title={`Delete segment ${pendingDelete?.name ?? ''}?`}
        description="Membership rows are removed; the timeline keeps historical enter/exit entries."
        confirmLabel="Delete"
        tone="destructive"
        isPending={deleteSegment.isPending}
        onConfirm={async () => {
          if (!pendingDelete) {
            return
          }
          try {
            await deleteSegment.mutateAsync(pendingDelete.id)
            notifySuccess('Segment deleted')
            setPendingDelete(null)
          } catch (error: unknown) {
            notifyError(errorMessage(error))
          }
        }}
      />
    </WorkspacePage>
  )
}
