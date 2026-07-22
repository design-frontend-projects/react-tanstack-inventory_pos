import { createFileRoute } from '@tanstack/react-router'
import { OrganizationWorkspace } from '#/features/hr/organization-workspace'

export const Route = createFileRoute('/_app/hr/organization')({
  component: OrganizationPage,
})

function OrganizationPage() {
  return <OrganizationWorkspace />
}
