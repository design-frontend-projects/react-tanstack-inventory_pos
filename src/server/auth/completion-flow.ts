import type { User } from '@supabase/supabase-js'
import type { CompletionFlowContext } from '#/types/auth'

const COMPLETION_FLOW_KEYS = [
  'auth_flow',
  'flow',
  'registration_id',
  'registrationId',
  'invitation_id',
  'invitationId',
] as const

function parseMetadataString(
  metadata: User['user_metadata'],
  ...keys: Array<string>
) {
  for (const key of keys) {
    const value = metadata[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

export function parseCompletionFlow(
  metadata: User['user_metadata']
): CompletionFlowContext | null {
  const flow = parseMetadataString(metadata, 'auth_flow', 'flow')
  const registrationId = parseMetadataString(
    metadata,
    'registration_id',
    'registrationId'
  )
  const invitationId = parseMetadataString(
    metadata,
    'invitation_id',
    'invitationId'
  )

  if (flow !== 'owner' && flow !== 'invite') {
    return null
  }

  return {
    flow,
    registrationId,
    invitationId,
  }
}

export function stripCompletionFlowMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  const nextMetadata = { ...(metadata ?? {}) }

  for (const key of COMPLETION_FLOW_KEYS) {
    delete nextMetadata[key]
  }

  return nextMetadata
}
