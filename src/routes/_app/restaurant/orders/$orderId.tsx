import { createFileRoute } from '@tanstack/react-router'
import { OrderWorkspace } from '#/features/restaurant/orders/order-workspace'

export const Route = createFileRoute('/_app/restaurant/orders/$orderId')({
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  return <OrderWorkspace orderId={orderId} />
}
