import { createFileRoute } from '@tanstack/react-router'
import { LearningWorkspace } from '#/features/hr/learning-workspace'

export const Route = createFileRoute('/_app/hr/training')({
  component: TrainingPage,
})

function TrainingPage() {
  return <LearningWorkspace />
}
