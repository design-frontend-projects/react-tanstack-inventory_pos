import { createFileRoute } from '@tanstack/react-router'
import { CostCenterWorkspace } from '#/features/hr/org-master-workspaces'

export const Route = createFileRoute('/_app/hr/cost-centers')({
  component: CostCentersPage,
})

function CostCentersPage() {
  return <CostCenterWorkspace />
}
