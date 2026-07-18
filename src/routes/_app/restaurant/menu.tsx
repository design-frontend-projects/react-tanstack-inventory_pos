import { createFileRoute } from '@tanstack/react-router'
import { MenuWorkspace } from '#/features/restaurant/menu/menu-workspace'

export const Route = createFileRoute('/_app/restaurant/menu')({
  component: MenuWorkspace,
})
