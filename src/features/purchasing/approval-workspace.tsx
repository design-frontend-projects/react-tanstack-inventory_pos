'use client'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  useApprovalActions,
  useMyApprovals,
} from '#/features/purchasing/use-approvals'

const ENTITY_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  purchase_requisition: 'Requisition',
  supplier_invoice: 'Supplier Invoice',
}

export function ApprovalWorkspace() {
  const approvalsQuery = useMyApprovals()
  const { act } = useApprovalActions()
  const approvals = approvalsQuery.data ?? []

  const decide = (id: string, action: 'approve' | 'reject') => {
    act.mutate({ id, input: { action } })
  }

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Approvals"
      title="Clear your procurement approval queue."
      description="Amount-gated sign-off routes purchase orders (and later requisitions and invoices) to the right approver. Approve, reject, or delegate — every decision is audit-logged and event-sourced."
      metrics={[
        {
          label: 'My queue',
          value: approvalsQuery.data ? String(approvals.length) : '—',
          hint: 'Requests awaiting your decision',
          tone: 'red',
        },
        {
          label: 'Routing',
          value: 'Amount + role',
          hint: 'Workflow-driven step selection',
          tone: 'accent',
        },
        {
          label: 'Audit',
          value: 'Full trail',
          hint: 'Every action recorded',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Pending decisions"
        title="Your approval inbox"
        description="Only requests whose current step targets you (by role, profile, or delegation) appear here."
      >
        {approvalsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading approvals…</p>
        ) : approvalsQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load approvals"
            description="Check your connection and permissions, then retry."
          />
        ) : approvals.length === 0 ? (
          <WorkspaceEmptyState
            title="Inbox zero"
            description="Nothing is waiting on your approval right now."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-176 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Document</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Amount</th>
                  <th className="py-2 pr-4 text-right font-medium">Step</th>
                  <th className="py-2 pr-4 font-medium">Requested</th>
                  <th className="py-2 text-right font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((request) => (
                  <tr key={request.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">
                      <span className="font-medium">
                        {ENTITY_LABELS[request.entityType] ??
                          request.entityType}
                      </span>
                    </td>
                    <td className="py-2 pr-4 capitalize">
                      {request.statusCode.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {request.amount ?? '—'} {request.currencyCode ?? ''}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {request.currentStepOrder}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="xs"
                          disabled={act.isPending}
                          onClick={() => decide(request.id, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={act.isPending}
                          onClick={() => decide(request.id, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspacePanel>
    </WorkspacePage>
  )
}
