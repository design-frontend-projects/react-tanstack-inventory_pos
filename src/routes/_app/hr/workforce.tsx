import { createFileRoute } from '@tanstack/react-router'
import { WorkforceWorkspace } from '#/features/hr/workforce-workspace'

export const Route = createFileRoute('/_app/hr/workforce')({
  component: WorkforcePage,
})

function WorkforcePage() {
  return <WorkforceWorkspace />
}
