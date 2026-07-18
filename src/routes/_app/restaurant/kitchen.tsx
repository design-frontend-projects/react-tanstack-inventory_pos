import { createFileRoute } from '@tanstack/react-router'
import { KitchenBoardWorkspace } from '#/features/restaurant/kitchen/kitchen-board-workspace'

export const Route = createFileRoute('/_app/restaurant/kitchen')({
  component: KitchenBoardWorkspace,
})
