import { createFileRoute } from '@tanstack/react-router'
import { PaymentWorkspace } from '#/features/purchasing/payment-workspace'

export const Route = createFileRoute('/_app/purchase/payments')({
  component: PaymentsPage,
})

function PaymentsPage() {
  return <PaymentWorkspace />
}
