import { describe, expect, it } from 'vitest'
import {
  invitationAcceptanceSchema,
  PASSWORD_POLICY_MESSAGE,
  signUpSchema,
} from '#/features/auth/validation'

describe('auth validation', () => {
  it('normalizes and accepts a valid tenant signup payload', () => {
    const parsed = signUpSchema.parse({
      firstName: 'Nadia',
      lastName: 'Hassan',
      email: 'OWNER@Example.COM',
      phone: '+20 100 000 0000',
      activity: 'restaurant',
      origin: 'https://app.example.com',
    })

    expect(parsed.email).toBe('owner@example.com')
    expect(parsed.activity).toBe('restaurant')
  })

  it('enforces the stronger password policy during invitation acceptance', () => {
    const parsed = invitationAcceptanceSchema.safeParse({
      invitationId: '550e8400-e29b-41d4-a716-446655440000',
      firstName: 'Nadia',
      lastName: 'Hassan',
      phone: '+20 100 000 0000',
      avatarUrl: '',
      password: 'weakpass',
      confirmPassword: 'weakpass',
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(PASSWORD_POLICY_MESSAGE)
    }
  })

  it('allows invitation acceptance without forcing a password reset', () => {
    const parsed = invitationAcceptanceSchema.parse({
      invitationId: '550e8400-e29b-41d4-a716-446655440000',
      firstName: 'Nadia',
      lastName: 'Hassan',
      phone: '',
      avatarUrl: '',
      password: '',
      confirmPassword: '',
    })

    expect(parsed.password).toBe('')
    expect(parsed.confirmPassword).toBe('')
  })
})
