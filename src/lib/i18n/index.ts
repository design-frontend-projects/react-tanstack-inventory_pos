import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import arCommon from '#/lib/i18n/resources/ar/common.json'
import enCommon from '#/lib/i18n/resources/en/common.json'
import type { AppLocale } from '#/types/app'

export const supportedLocales = ['en', 'ar'] as const

export const localeMeta: Record<
  AppLocale,
  { label: string; nativeLabel: string; dir: 'ltr' | 'rtl' }
> = {
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
}

export function resolveLocale(input?: string | null): AppLocale {
  if (!input) {
    return 'en'
  }

  return input.toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

export function applyLocaleDocument(locale: AppLocale) {
  if (typeof document === 'undefined') {
    return
  }

  const meta = localeMeta[locale]
  document.documentElement.lang = locale
  document.documentElement.dir = meta.dir
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { common: enCommon },
      ar: { common: arCommon },
    },
    lng: typeof window === 'undefined' ? 'en' : resolveLocale(navigator.language),
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })
}

export default i18n
