import { createFileRoute } from '@tanstack/react-router'
import { GiftCardsWorkspace } from '#/features/restaurant/promotions/gift-cards-workspace'

export const Route = createFileRoute('/_app/restaurant/gift-cards')({
  component: GiftCardsPage,
})

function GiftCardsPage() {
  return <GiftCardsWorkspace />
}
