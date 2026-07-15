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

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: requiredUrlEnv('VITE_SUPABASE_URL'),
  VITE_SUPABASE_ANON_KEY: requiredEnv('VITE_SUPABASE_ANON_KEY'),
  VITE_GOOGLE_MAPS_API_KEY: optionalEnv,
})

export const clientEnv = clientEnvSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
})
