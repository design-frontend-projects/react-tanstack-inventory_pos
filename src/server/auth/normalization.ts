export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function buildDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null
) {
  const joined = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ')
  return joined || fallback?.trim() || 'Unnamed User'
}
