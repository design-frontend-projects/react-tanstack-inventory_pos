import { createFileRoute } from '@tanstack/react-router'
import { PromotionsWorkspace } from '#/features/restaurant/promotions/promotions-workspace'

export const Route = createFileRoute('/_app/restaurant/promotions')({
  component: PromotionsPage,
})

function PromotionsPage() {
  return <PromotionsWorkspace />
}
