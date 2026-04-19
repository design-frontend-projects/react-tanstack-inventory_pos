"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppLocale } from '#/types/app'
import type { LayoutDirection } from '#/lib/i18n/locale'
import { resolveLocale, resolveLocaleDirection } from '#/lib/i18n/locale'
import { LAYOUT_STORAGE_KEY } from '#/lib/layout/constants'
import {
  DEFAULT_PERSISTED_LAYOUT_STATE,
  createDefaultLayoutState,
  normalizePersistedLayoutState,
  parsePersistedLayoutState,
} from '#/lib/layout/persistence'

type BooleanUpdater = boolean | ((current: boolean) => boolean)

type LayoutState = {
  locale: AppLocale
  direction: LayoutDirection
  sidebarOpen: boolean
  sidebarOpenMobile: boolean
  setLocale: (locale: AppLocale) => void
  setDirection: (direction: LayoutDirection) => void
  setSidebarOpen: (value: BooleanUpdater) => void
  setSidebarOpenMobile: (value: BooleanUpdater) => void
  toggleSidebar: (isMobile?: boolean) => void
}

function resolveBooleanUpdater(
  value: BooleanUpdater,
  current: boolean
): boolean {
  return typeof value === 'function' ? value(current) : value
}

function getInitialLayoutState() {
  if (typeof window === 'undefined') {
    return DEFAULT_PERSISTED_LAYOUT_STATE
  }

  try {
    const storedState = window.localStorage.getItem(LAYOUT_STORAGE_KEY)

    if (storedState) {
      return parsePersistedLayoutState(storedState)
    }
  } catch {
    return createDefaultLayoutState(resolveLocale(navigator.language))
  }

  return createDefaultLayoutState(resolveLocale(navigator.language))
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      ...getInitialLayoutState(),
      sidebarOpenMobile: false,
      setLocale: (locale) =>
        set({
          locale,
          direction: resolveLocaleDirection(locale),
        }),
      setDirection: (direction) => set({ direction }),
      setSidebarOpen: (value) =>
        set((state) => ({
          sidebarOpen: resolveBooleanUpdater(value, state.sidebarOpen),
        })),
      setSidebarOpenMobile: (value) =>
        set((state) => ({
          sidebarOpenMobile: resolveBooleanUpdater(
            value,
            state.sidebarOpenMobile
          ),
        })),
      toggleSidebar: (isMobile = false) => {
        if (isMobile) {
          get().setSidebarOpenMobile((current) => !current)
          return
        }

        get().setSidebarOpen((current) => !current)
      },
    }),
    {
      name: LAYOUT_STORAGE_KEY,
      partialize: (state) => ({
        locale: state.locale,
        direction: state.direction,
        sidebarOpen: state.sidebarOpen,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePersistedLayoutState(persistedState),
      }),
    }
  )
)
