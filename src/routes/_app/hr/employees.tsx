import { createFileRoute } from '@tanstack/react-router'
import { EmployeeWorkspace } from '#/features/hr/employee-workspace'

export const Route = createFileRoute('/_app/hr/employees')({
  component: EmployeesPage,
})

function EmployeesPage() {
  return <EmployeeWorkspace />
}
