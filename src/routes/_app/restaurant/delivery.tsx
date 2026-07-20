import { createFileRoute } from '@tanstack/react-router'
import { DeliveryWorkspace } from '#/features/restaurant/delivery/delivery-workspace'

export const Route = createFileRoute('/_app/restaurant/delivery')({
  component: DeliveryPage,
})

function DeliveryPage() {
  return <DeliveryWorkspace />
}
