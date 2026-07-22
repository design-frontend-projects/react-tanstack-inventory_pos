import { createFileRoute } from '@tanstack/react-router'
import { HrAnalyticsWorkspace } from '#/features/hr/analytics-workspace'

export const Route = createFileRoute('/_app/hr/analytics')({
  component: HrAnalyticsPage,
})

function HrAnalyticsPage() {
  return <HrAnalyticsWorkspace />
}
