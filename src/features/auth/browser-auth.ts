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

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signInWithPassword({
    email,
    password,
  })
}

export async function sendMagicLink(email: string, origin: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: new URL('/complete-profile', origin).toString(),
    },
  })
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signOut()
}
