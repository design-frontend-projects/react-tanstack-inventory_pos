import { createFileRoute } from '@tanstack/react-router'
import { HrOverviewWorkspace } from '#/features/hr/hr-overview-workspace'

export const Route = createFileRoute('/_app/hr/')({
  component: HrOverviewPage,
})

function HrOverviewPage() {
  return <HrOverviewWorkspace />
}
