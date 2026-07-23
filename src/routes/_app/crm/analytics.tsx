import { createFileRoute } from '@tanstack/react-router'
import { CrmAnalyticsWorkspace } from '#/features/crm/analytics-workspace'

export const Route = createFileRoute('/_app/crm/analytics')({
  component: CrmAnalyticsPage,
})

function CrmAnalyticsPage() {
  return <CrmAnalyticsWorkspace />
}
