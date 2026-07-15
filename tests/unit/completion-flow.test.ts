import { describe, expect, it } from 'vitest'
import { stripCompletionFlowMetadata } from '#/server/auth/completion-flow'

describe('completion flow metadata', () => {
  it('removes owner and invitation flow keys while preserving other metadata', () => {
    expect(
      stripCompletionFlowMetadata({
        auth_flow: 'owner',
        registration_id: 'registration-id',
        invitation_id: 'invitation-id',
        first_name: 'Nadia',
        auth_delivery: 'otp',
      })
    ).toEqual({
      first_name: 'Nadia',
      auth_delivery: 'otp',
    })
  })

  it('handles empty metadata safely', () => {
    expect(stripCompletionFlowMetadata(undefined)).toEqual({})
  })
})
