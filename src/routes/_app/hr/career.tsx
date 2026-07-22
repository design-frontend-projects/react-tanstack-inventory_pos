import { createFileRoute } from '@tanstack/react-router'
import { CareerWorkspace } from '#/features/hr/career-workspace'

export const Route = createFileRoute('/_app/hr/career')({
  component: CareerPage,
})

function CareerPage() {
  return <CareerWorkspace />
}
