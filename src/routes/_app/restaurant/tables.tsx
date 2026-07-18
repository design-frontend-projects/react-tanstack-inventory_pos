import { createFileRoute } from '@tanstack/react-router'
import { FloorLiveWorkspace } from '#/features/restaurant/floor/floor-live-workspace'

export const Route = createFileRoute('/_app/restaurant/tables')({
  component: FloorLiveWorkspace,
})
