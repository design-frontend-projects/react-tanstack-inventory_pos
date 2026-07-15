"use client"

import { getSupabaseBrowserClient } from '#/lib/supabase/client'

export async function getAccessToken() {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token ?? null
}

export async function getSupabaseUser() {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function requestSignInOtp(email: string) {
  const supabase = getSupabaseBrowserClient()

  // Hosted Supabase projects need the Magic Link email template to branch on
  // auth_flow so sign-in renders {{ .Token }} while onboarding keeps links.
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      data: {
        auth_flow: 'sign_in',
        auth_delivery: 'otp',
      },
    },
  })
}

export async function verifySignInOtp(email: string, token: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signOut()
}
