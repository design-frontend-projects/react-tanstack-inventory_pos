import { createAdminSupabaseClient } from '#/server/auth/supabase-admin'
import { ValidationError } from '#/server/auth/errors'
import { normalizeEmail } from '#/server/auth/normalization'

export async function findAuthUserByEmail(email: string) {
  const adminClient = createAdminSupabaseClient()
  let page = 1

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw new ValidationError(error.message)
    }

    const matchingUser = data.users.find(
      (user) => normalizeEmail(user.email ?? '') === normalizeEmail(email)
    )

    if (matchingUser) {
      return matchingUser
    }

    if (data.users.length < 200) {
      break
    }

    page += 1
  }

  return null
}

export async function findAuthUserById(authUserId: string) {
  const adminClient = createAdminSupabaseClient()
  const { data, error } = await adminClient.auth.admin.getUserById(authUserId)

  if (error) {
    throw new ValidationError(error.message)
  }

  return data.user
}

export async function updateAuthUserMetadata(
  authUserId: string,
  metadata: Record<string, unknown>
) {
  const adminClient = createAdminSupabaseClient()
  const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
    user_metadata: metadata,
  })

  if (error) {
    throw new ValidationError(error.message)
  }
}

export async function setAuthUserPassword(authUserId: string, password: string) {
  const adminClient = createAdminSupabaseClient()
  const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
    password,
  })

  if (error) {
    throw new ValidationError(error.message)
  }
}
