import { createFileRoute } from '@tanstack/react-router'
import { LeaveWorkspace } from '#/features/hr/leave-workspace'

export const Route = createFileRoute('/_app/hr/leave')({
  component: LeavePage,
})

function LeavePage() {
  return <LeaveWorkspace />
}
