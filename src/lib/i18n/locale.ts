import type { AppLocale } from '#/types/app'

export type LayoutDirection = 'ltr' | 'rtl'

export const supportedLocales = ['en', 'ar'] as const
export const DEFAULT_LOCALE: AppLocale = 'en'

export const localeMeta: Record<
  AppLocale,
  { label: string; nativeLabel: string; dir: LayoutDirection }
> = {
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
}

export function resolveLocale(input?: string | null): AppLocale {
  if (!input) {
    return DEFAULT_LOCALE
  }

  return input.toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

export function resolveLocaleDirection(locale: AppLocale): LayoutDirection {
  return localeMeta[locale].dir
}
