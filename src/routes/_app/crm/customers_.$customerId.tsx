import { createFileRoute } from '@tanstack/react-router'
import { CustomerDetailPage } from '#/features/crm/customer-detail-page'

export const Route = createFileRoute('/_app/crm/customers_/$customerId')({
  component: CustomerDetailRoute,
})

function CustomerDetailRoute() {
  const { customerId } = Route.useParams()
  return <CustomerDetailPage customerId={customerId} />
}
