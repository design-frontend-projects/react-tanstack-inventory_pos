import { createFileRoute } from '@tanstack/react-router'
import { FloorPlanWorkspace } from '#/features/restaurant/floor/floor-plan-workspace'

export const Route = createFileRoute('/_app/restaurant/floor-plan')({
  component: FloorPlanWorkspace,
})
