import { createFileRoute } from '@tanstack/react-router'
import { EmployeeDetailPage } from '#/features/hr/employee-detail-page'

export const Route = createFileRoute('/_app/hr/employees_/$employeeId')({
  component: EmployeeDetailRoute,
})

function EmployeeDetailRoute() {
  const { employeeId } = Route.useParams()
  return <EmployeeDetailPage employeeId={employeeId} />
}
