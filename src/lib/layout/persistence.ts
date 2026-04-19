import type { AppLocale } from '#/types/app'
import type { LayoutDirection } from '#/lib/i18n/locale'
import {
  DEFAULT_LOCALE,
  resolveLocale,
  resolveLocaleDirection,
} from '#/lib/i18n/locale'
import {
  DEFAULT_SIDEBAR_OPEN,
  LAYOUT_STORAGE_KEY,
} from '#/lib/layout/constants'

export type PersistedLayoutState = {
  locale: AppLocale
  direction: LayoutDirection
  sidebarOpen: boolean
}

const DEFAULT_DIRECTION = resolveLocaleDirection(DEFAULT_LOCALE)

export const DEFAULT_PERSISTED_LAYOUT_STATE: PersistedLayoutState = {
  locale: DEFAULT_LOCALE,
  direction: DEFAULT_DIRECTION,
  sidebarOpen: DEFAULT_SIDEBAR_OPEN,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createDefaultLayoutState(
  locale: AppLocale = DEFAULT_LOCALE
): PersistedLayoutState {
  return {
    locale,
    direction: resolveLocaleDirection(locale),
    sidebarOpen: DEFAULT_SIDEBAR_OPEN,
  }
}

export function normalizePersistedLayoutState(
  value: unknown
): PersistedLayoutState {
  if (!isRecord(value)) {
    return DEFAULT_PERSISTED_LAYOUT_STATE
  }

  const locale = resolveLocale(
    typeof value.locale === 'string' ? value.locale : DEFAULT_LOCALE
  )
  const direction =
    value.direction === 'rtl' || value.direction === 'ltr'
      ? value.direction
      : resolveLocaleDirection(locale)
  const sidebarOpen =
    typeof value.sidebarOpen === 'boolean'
      ? value.sidebarOpen
      : DEFAULT_SIDEBAR_OPEN

  return {
    locale,
    direction,
    sidebarOpen,
  }
}

export function parsePersistedLayoutState(
  rawValue: string | null
): PersistedLayoutState {
  if (!rawValue) {
    return DEFAULT_PERSISTED_LAYOUT_STATE
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    const state =
      isRecord(parsed) && 'state' in parsed
        ? (parsed as { state?: unknown }).state
        : parsed

    return normalizePersistedLayoutState(state)
  } catch {
    return DEFAULT_PERSISTED_LAYOUT_STATE
  }
}

export function readPersistedLayoutState(
  storage?: Pick<Storage, 'getItem'> | null
): PersistedLayoutState {
  if (!storage) {
    return DEFAULT_PERSISTED_LAYOUT_STATE
  }

  return parsePersistedLayoutState(storage.getItem(LAYOUT_STORAGE_KEY))
}

export function createLayoutInitScript() {
  const storageKey = JSON.stringify(LAYOUT_STORAGE_KEY)
  const defaultLocale = JSON.stringify(DEFAULT_LOCALE)
  const defaultDirection = JSON.stringify(DEFAULT_DIRECTION)

  return `(function(){try{var raw=window.localStorage.getItem(${storageKey});var parsed=raw?JSON.parse(raw):null;var state=parsed&&typeof parsed==='object'&&'state' in parsed?parsed.state:parsed;var locale=${defaultLocale};var direction=${defaultDirection};if(state&&typeof state==='object'){if(typeof state.locale==='string'){locale=state.locale.toLowerCase().indexOf('ar')===0?'ar':'en';}else{locale=(navigator.language||'').toLowerCase().indexOf('ar')===0?'ar':'en';}if(state.direction==='rtl'||state.direction==='ltr'){direction=state.direction;}else{direction=locale==='ar'?'rtl':'ltr';}}else{locale=(navigator.language||'').toLowerCase().indexOf('ar')===0?'ar':'en';direction=locale==='ar'?'rtl':'ltr';}document.documentElement.lang=locale;document.documentElement.dir=direction;}catch(e){var fallbackLocale=(navigator.language||'').toLowerCase().indexOf('ar')===0?'ar':'en';document.documentElement.lang=fallbackLocale;document.documentElement.dir=fallbackLocale==='ar'?'rtl':'ltr';}})();`
}
