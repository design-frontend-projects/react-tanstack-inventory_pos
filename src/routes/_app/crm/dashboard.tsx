import { createFileRoute } from '@tanstack/react-router'
import { CrmDashboardWorkspace } from '#/features/crm/dashboard-workspace'

export const Route = createFileRoute('/_app/crm/dashboard')({
  component: CrmDashboardPage,
})

function CrmDashboardPage() {
  return <CrmDashboardWorkspace />
}
