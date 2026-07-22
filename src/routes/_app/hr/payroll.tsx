import { createFileRoute } from '@tanstack/react-router'
import { PayrollWorkspace } from '#/features/hr/payroll-workspace'

export const Route = createFileRoute('/_app/hr/payroll')({
  component: PayrollPage,
})

function PayrollPage() {
  return <PayrollWorkspace />
}
