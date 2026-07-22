import { createFileRoute } from '@tanstack/react-router'
import { OnboardingWorkspace } from '#/features/hr/onboarding-workspace'

export const Route = createFileRoute('/_app/hr/onboarding')({
  component: OnboardingPage,
})

function OnboardingPage() {
  return <OnboardingWorkspace />
}
