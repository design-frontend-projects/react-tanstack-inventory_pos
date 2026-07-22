import { createFileRoute } from '@tanstack/react-router'
import { PositionWorkspace } from '#/features/hr/org-master-workspaces'

export const Route = createFileRoute('/_app/hr/positions')({
  component: PositionsPage,
})

function PositionsPage() {
  return <PositionWorkspace />
}
