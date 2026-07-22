import { createFileRoute } from '@tanstack/react-router'
import { DepartmentWorkspace } from '#/features/hr/org-master-workspaces'

export const Route = createFileRoute('/_app/hr/departments')({
  component: DepartmentsPage,
})

function DepartmentsPage() {
  return <DepartmentWorkspace />
}
