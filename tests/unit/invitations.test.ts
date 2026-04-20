import { describe, expect, it } from 'vitest'
import { canResendInvitation } from '#/features/auth/invitations'

describe('invitation status helpers', () => {
  it('allows resend only for pending and expired invitations', () => {
    expect(canResendInvitation('pending')).toBe(true)
    expect(canResendInvitation('expired')).toBe(true)
    expect(canResendInvitation('accepted')).toBe(false)
    expect(canResendInvitation('revoked')).toBe(false)
    expect(canResendInvitation('failed')).toBe(false)
    expect(canResendInvitation(null)).toBe(false)
  })
})
