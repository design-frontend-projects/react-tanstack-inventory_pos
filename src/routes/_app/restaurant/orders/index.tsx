import { createFileRoute } from '@tanstack/react-router'
import { OrdersBoardWorkspace } from '#/features/restaurant/orders/orders-board-workspace'

export const Route = createFileRoute('/_app/restaurant/orders/')({
  component: OrdersBoardWorkspace,
})
