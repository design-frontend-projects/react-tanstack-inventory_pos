import { createFileRoute } from '@tanstack/react-router'
import { CrmCustomersWorkspace } from '#/features/crm/customers-workspace'

export const Route = createFileRoute('/_app/crm/customers')({
  component: CrmCustomersPage,
})

function CrmCustomersPage() {
  return <CrmCustomersWorkspace />
}
