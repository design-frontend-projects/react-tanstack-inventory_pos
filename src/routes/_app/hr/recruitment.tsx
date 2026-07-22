import { createFileRoute } from '@tanstack/react-router'
import { RecruitmentWorkspace } from '#/features/hr/recruitment-workspace'

export const Route = createFileRoute('/_app/hr/recruitment')({
  component: RecruitmentPage,
})

function RecruitmentPage() {
  return <RecruitmentWorkspace />
}
