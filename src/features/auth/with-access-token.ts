"use client"

import { getAccessToken } from '#/features/auth/browser-auth'

export async function withAccessToken<T>(
  callback: (accessToken: string) => Promise<T>
) {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('A signed-in session is required.')
  }

  return callback(accessToken)
}
