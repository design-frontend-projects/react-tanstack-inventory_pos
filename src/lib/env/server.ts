import { z } from 'zod'

const optionalEnv = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalizedValue = value.trim()

  return normalizedValue.length > 0 ? normalizedValue : undefined
}, z.string().optional())

const requiredEnv = (name: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z.string().min(1, `${name} is required`)
  )

const requiredUrlEnv = (name: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z
      .string()
      .min(1, `${name} is required`)
      .url(`${name} must be a valid URL`)
  )

const serverEnvSchema = z.object({
  DATABASE_URL: requiredEnv('DATABASE_URL'),
  VITE_SUPABASE_URL: requiredUrlEnv('VITE_SUPABASE_URL'),
  VITE_SUPABASE_ANON_KEY: requiredEnv('VITE_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: optionalEnv,
  VITE_SUPABASE_SECRET_KEY: optionalEnv,
  ONESIGNAL_APP_ID: optionalEnv,
  ONESIGNAL_APP_API_KEY: optionalEnv,
})

export const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  VITE_SUPABASE_SECRET_KEY: process.env.VITE_SUPABASE_SECRET_KEY,
  ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID,
  ONESIGNAL_APP_API_KEY: process.env.ONESIGNAL_APP_API_KEY,
})
