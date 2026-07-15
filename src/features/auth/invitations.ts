import type { InvitationStatusCode } from '#/types/auth'

export const RESENDABLE_INVITATION_STATUSES = ['pending', 'expired'] as const

export function canResendInvitation(
  status: InvitationStatusCode | null | undefined
): status is (typeof RESENDABLE_INVITATION_STATUSES)[number] {
  if (!status) {
    return false
  }

  return RESENDABLE_INVITATION_STATUSES.includes(
    status as (typeof RESENDABLE_INVITATION_STATUSES)[number]
  )
}
