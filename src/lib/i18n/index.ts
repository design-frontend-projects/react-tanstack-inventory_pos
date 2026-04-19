import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import arCommon from '#/lib/i18n/resources/ar/common.json'
import enCommon from '#/lib/i18n/resources/en/common.json'
import type { LayoutDirection } from '#/lib/i18n/locale'
import { LAYOUT_STORAGE_KEY } from '#/lib/layout/constants'
import type { AppLocale } from '#/types/app'
import {
  DEFAULT_LOCALE,
  localeMeta,
  resolveLocale,
  resolveLocaleDirection,
  supportedLocales,
} from '#/lib/i18n/locale'

function getInitialLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  try {
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY)

    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      const state =
        typeof parsed === 'object' && parsed !== null && 'state' in parsed
          ? (parsed as { state?: unknown }).state
          : parsed
      const locale =
        typeof state === 'object' && state !== null && 'locale' in state
          ? (state as { locale?: string }).locale
          : undefined

      return resolveLocale(locale ?? navigator.language)
    }
  } catch {
    return resolveLocale(navigator.language)
  }

  return resolveLocale(navigator.language)
}

export function applyLocaleDocument(
  locale: AppLocale,
  direction: LayoutDirection = resolveLocaleDirection(locale)
) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = locale
  document.documentElement.dir = direction
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { common: enCommon },
      ar: { common: arCommon },
    },
    lng: getInitialLocale(),
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })
}

export {
  supportedLocales,
  localeMeta,
  resolveLocale,
  resolveLocaleDirection,
}

export default i18n
