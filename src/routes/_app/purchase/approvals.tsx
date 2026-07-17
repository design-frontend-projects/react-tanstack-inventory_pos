import { createFileRoute } from '@tanstack/react-router'
import { ApprovalWorkspace } from '#/features/purchasing/approval-workspace'

export const Route = createFileRoute('/_app/purchase/approvals')({
  component: ApprovalsPage,
})

function ApprovalsPage() {
  return <ApprovalWorkspace />
}
