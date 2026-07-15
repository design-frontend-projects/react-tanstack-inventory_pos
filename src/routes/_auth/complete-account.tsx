import { createFileRoute } from '@tanstack/react-router'
import { CompleteAccountPage } from '#/features/auth/complete-account-page'

export const Route = createFileRoute('/_auth/complete-account')({
  component: CompleteAccountPage,
})
