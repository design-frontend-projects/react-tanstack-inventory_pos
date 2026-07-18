'use client'

import { getAccessToken } from '#/features/auth/browser-auth'

export async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to use restaurant screens.')
  }

  return accessToken
}
